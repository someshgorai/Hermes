import { logger } from "../lib/logger";
import { Worker } from "bullmq";
import { queueConnection } from "../queues/queue";
import { db } from "../database/drizzle";
import {
  suppliers,
  ports,
  routeScores,
  riskEvents,
  supplierExportPorts,
  supplierScoreHistory,
} from "../database/schema";
import { eq, and, lt } from "drizzle-orm";
import { scoreEventRisk } from "../risk/eventRisk";
import { scoreCurrentWeather, scoreWeatherForecast } from "../risk/weatherRisk";
import { scoreAllRoutes } from "../risk/routeScorer";
import { combinedScore } from "../risk/operationalRisk";
import { upsertScoreHistory } from "../services/scoreHistory.service";
import { createRecommendation } from "../services/recommendation.service";
import { createAlert } from "../services/alert.service";
import { findBestRoute } from "../risk/smartRouter";
import { emitToOrg } from "../socket";

/** Job data shape pushed onto the analysis queue. */
export interface AnalysisJobData {
  supplierId: string;
  organizationId: string;
  supplierName: string;
  country: string;
  warehouseId?: string;
}



/**
 * Fetches the primary export port ID for a supplier.
 * Returns undefined if no export ports are configured.
 */
async function getPrimaryExportPortId(
  supplierId: string,
): Promise<string | undefined> {
  const exportPorts = await db
    .select({ portId: supplierExportPorts.portId })
    .from(supplierExportPorts)
    .where(
      and(
        eq(supplierExportPorts.supplierId, supplierId),
        eq(supplierExportPorts.isPrimary, true),
      ),
    )
    .limit(1);

  return exportPorts.length > 0 ? exportPorts[0].portId : undefined;
}

/**
 * BullMQ worker that orchestrates the full analysis pipeline for a supplier.
 *
 * Steps:
 * 1.  Load supplier from DB
 * 2.  Run event + current weather risk in parallel
 * 3.  Score all route combinations
 * 4.  Compute today's combined supplier score using primary route
 * 5.  Run 5-day weather forecast
 * 6.  Build forecast score rows (Day 2–5)
 * 7.  Find best alternative route
 * 8.  Upsert today's real score history
 * 9.  Upsert 5-day forecast score history
 * 10. Update supplier current scores in DB
 * 11. Upsert route scores using onConflictDoUpdate
 * 12. Insert new risk events
 * 13. Save recommendation if improvement is significant
 * 14. Create alert if risk is high or critical
 * 15. Emit real-time socket events
 */
export const analysisWorker = new Worker<AnalysisJobData>(
  "supplier-analysis",
  async (job) => {
    const { supplierId, organizationId, supplierName, country, warehouseId } =
      job.data;

    logger.info({ supplierId, supplierName }, "Analysis job started");

    // ── Step 1: Load supplier from DB ────────────────────────────────────────
    const supplierRows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId));

    if (supplierRows.length === 0) {
      logger.warn({ supplierId }, "Supplier not found — skipping analysis");
      return;
    }

    const supplier = supplierRows[0];

    // ── Step 1b: Purge stale data from previous runs ─────────────────────────
    // Delete old score history and risk events (before today) so the dashboard
    // accumulates a historical record while keeping each day's data fresh.
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const startOfToday = new Date(todayStr);

    await Promise.all([
      db
        .delete(supplierScoreHistory)
        .where(
          and(
            eq(supplierScoreHistory.supplierId, supplierId),
            lt(supplierScoreHistory.date, todayStr),
          ),
        ),
      db
        .delete(riskEvents)
        .where(
          and(
            eq(riskEvents.supplierId, supplierId),
            lt(riskEvents.createdAt, startOfToday),
          ),
        ),
    ]);

    logger.info({ supplierId }, "Purged stale score history and risk events");

    // Notify frontend that analysis is in progress so it can show loading states.
    emitToOrg(organizationId, "analysis:started", { supplierId });

    // ── Resolve primary export port coordinates ───────────────────────────────
    const primaryPortId = await getPrimaryExportPortId(supplierId);
    const allPorts = await db.select().from(ports);
    const portMap = new Map(allPorts.map((p) => [p.id, p]));
    const exportPort = primaryPortId ? portMap.get(primaryPortId) : undefined;

    if (!exportPort) {
      logger.warn(
        { supplierId },
        "No primary export port found — weather check using supplier origin",
      );
    }

    const exportPortLat = exportPort?.lat ?? supplier.originLat;
    const exportPortLng = exportPort?.lng ?? supplier.originLng;

    // Use supplier origin as fallback for import port coords
    // (accurate per-warehouse weather is handled inside scoreAllRoutes)
    const coords = {
      originLat: supplier.originLat,
      originLng: supplier.originLng,
      exportPortLat,
      exportPortLng,
      importPortLat: supplier.originLat,
      importPortLng: supplier.originLng,
      warehouseLat: supplier.originLat,
      warehouseLng: supplier.originLng,
    };

    // ── Step 2: Run event + current weather in parallel ──────────────────────
    const [eventResult, weatherResult] = await Promise.all([
      scoreEventRisk(supplierName, country),
      scoreCurrentWeather(coords),
    ]);

    // ── Step 3: Score all route combinations ─────────────────────────────────
    const supplierRouteInput = {
      id: supplier.id,
      organizationId: supplier.organizationId,
      originLat: supplier.originLat,
      originLng: supplier.originLng,
      leadTimeDays: supplier.leadTimeDays,
      dependency: supplier.dependency,
      shippingRatePerKm: supplier.shippingRatePerKm,
    };

    const allRoutes = await scoreAllRoutes(
      supplierRouteInput,
      eventResult,
      warehouseId,
    );

    if (allRoutes.length === 0) {
      logger.warn(
        { supplierId },
        "No routes scored — check export ports and warehouses",
      );
    }

    // ── Step 4: Compute today's score using primary route ────────────────────
    // Use primary route's operational score — not best route — for accurate
    // supplier-level score reflecting actual current shipping configuration.
    const primaryRoute =
      allRoutes.find((r) => r.exportPortId === primaryPortId) ??
      allRoutes[0] ??
      null;

    const operationalScore = primaryRoute?.operationalScore ?? 0;

    const todayScore = combinedScore(
      eventResult.score,
      operationalScore,
      weatherResult.score,
    );

    // ── Step 5: Run 5-day weather forecast ───────────────────────────────────
    const forecastResult = await scoreWeatherForecast(coords);

    // ── Step 6: Build forecast score rows (Day 2–5) ──────────────────────────
    // UTC date — consistent across timezones
    const today = new Date().toISOString().split("T")[0];

    const forecastScores = forecastResult.daily.slice(1).map((day) => {
      const forecast = combinedScore(
        eventResult.score, // fixed — cannot predict future news
        operationalScore, // fixed — distance/dependency don't change daily
        day.score, // changes per day based on weather forecast
      );

      return {
        date: day.date,
        isForecast: true as const,
        eventScore: eventResult.score,
        operationalScore,
        weatherScore: day.score,
        riskScore: forecast.score,
        riskLevel: forecast.level,
      };
    });

    // ── Step 7: Find best alternative route ──────────────────────────────────
    const recommendation = findBestRoute(allRoutes, primaryRoute);

    // ── Step 8: Upsert today's real score history ────────────────────────────
    await upsertScoreHistory(supplierId, organizationId, today, false, {
      riskScore: todayScore.score,
      eventScore: eventResult.score,
      weatherScore: weatherResult.score,
      operationalScore,
      riskLevel: todayScore.level,
    });

    // ── Step 9: Upsert 5-day forecast score history ──────────────────────────
    for (const day of forecastScores) {
      await upsertScoreHistory(supplierId, organizationId, day.date, true, {
        riskScore: day.riskScore,
        eventScore: day.eventScore,
        weatherScore: day.weatherScore,
        operationalScore: day.operationalScore,
        riskLevel: day.riskLevel,
      });
    }

    // ── Step 10: Update supplier current scores ──────────────────────────────
    await db
      .update(suppliers)
      .set({
        riskScore: todayScore.score,
        riskLevel: todayScore.level,
        eventScore: eventResult.score,
        operationalScore,
        weatherScore: weatherResult.score,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId));

    // ── Step 11: Upsert route scores ─────────────────────────────────────────
    // Uses onConflictDoUpdate on the unique (supplier, exportPort, importPort, warehouse)
    // constraint — avoids N+1 check queries from the previous approach.
    for (const route of allRoutes) {
      const routeData = {
        organizationId,
        supplierId,
        exportPortId: route.exportPortId,
        importPortId: route.importPortId,
        warehouseId: route.warehouseId,
        totalScore: route.totalScore,
        riskLevel: route.riskLevel,
        leg1Km: route.leg1Km,
        leg2Km: route.leg2Km,
        leg3Km: route.leg3Km,
        totalDistanceKm: route.totalDistanceKm,
        transitDays: route.transitDays,
        totalDeliveryDays: route.totalDeliveryDays,
        estimatedCostUsd: route.estimatedCostUsd,
        eventScore: route.eventScore,
        weatherScore: route.weatherScore,
        operationalScore: route.operationalScore,
        updatedAt: new Date(),
      };

      await db
        .insert(routeScores)
        .values(routeData)
        .onConflictDoUpdate({
          target: [
            routeScores.supplierId,
            routeScores.exportPortId,
            routeScores.importPortId,
            routeScores.warehouseId,
          ],
          set: { ...routeData, updatedAt: new Date() },
        });
    }

    // ── Step 12: Insert new risk events ──────────────────────────────────────
    if (eventResult.events.length > 0) {
      await db.insert(riskEvents).values(
        eventResult.events.map((e) => ({
          organizationId,
          supplierId,
          source: e.source,
          headline: e.headline,
          riskType: e.risk_type,
          severity: e.severity,
          summary: e.summary,
        })),
      );
    }

    // ── Step 13: Save recommendation if improvement is significant ────────────
    let recommendationId: string | undefined;

    if (recommendation) {
      const saved = await createRecommendation(
        organizationId,
        supplierId,
        recommendation,
      );
      recommendationId = saved.id;
    }

    // ── Step 14: Create alert if risk is high or critical ────────────────────
    if (todayScore.level === "high" || todayScore.level === "critical") {
      const alert = await createAlert({
        organizationId,
        supplierId,
        message: `${supplierName} is at ${todayScore.level.toUpperCase()} risk (score: ${todayScore.score}). ${
          eventResult.events[0]?.summary ?? "Multiple risk factors detected."
        }`,
        riskType: eventResult.events[0]?.risk_type ?? "logistics",
      });

      emitToOrg(organizationId, "alert:new", {
        alertId: alert.id,
        supplierId,
        message: alert.message,
      });
    }

    // ── Step 15: Emit real-time socket events ────────────────────────────────
    emitToOrg(organizationId, "risk:update", {
      supplierId,
      riskScore: todayScore.score,
      riskLevel: todayScore.level,
    });

    if (recommendation && recommendationId) {
      emitToOrg(organizationId, "recommendation:new", {
        recommendationId,
        supplierId,
        reason: recommendation.reason,
      });
    }

    logger.info(
      {
        supplierId,
        score: todayScore.score,
        level: todayScore.level,
        routeCount: allRoutes.length,
        eventCount: eventResult.events.length,
      },
      "Analysis job complete",
    );
  },
  {
    connection: queueConnection,
    concurrency: 5,
    prefix: "hermes",
  },
);

/** Logs when a job fails after all retry attempts. */
analysisWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Analysis job failed");
});

/** Logs when a job completes successfully. */
analysisWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Analysis job completed");
});
