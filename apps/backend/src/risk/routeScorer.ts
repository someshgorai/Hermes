import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database/drizzle";
import { supplierExportPorts, ports, warehouses } from "../database/schema";
import {
  scoreOperationalRisk,
  combinedScore,
  type OperationalRiskResult,
  type DependencyLevel,
} from "./operationalRisk";
import type { EventRiskResult } from "./eventRisk";
import { scoreCurrentWeather, type WeatherRiskResult } from "./weatherRisk";
import { logger } from "../lib/logger";

/**
 * A scored supplier route.
 */
export interface ScoredRoute {
  exportPortId: string;
  exportPortName: string;
  exportPortCountry: string;

  importPortId: string;
  importPortName: string;
  importPortCountry: string;

  warehouseId: string;
  warehouseName: string;

  totalScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";

  leg1Km: number;
  leg2Km: number;
  leg3Km: number;

  totalDistanceKm: number;

  transitDays: number;
  totalDeliveryDays: number;

  estimatedCostUsd: number;

  eventScore: number;
  weatherScore: number;
  operationalScore: number;
}

/**
 * Supplier information required for route scoring.
 */
export interface SupplierRouteInput {
  id: string;
  organizationId: string;

  originLat: number;
  originLng: number;

  leadTimeDays: number;
  dependency: DependencyLevel;

  shippingRatePerKm: number;
}

/**
 * Scores every valid route combination:
 *
 * Supplier
 *   → Export Port
 *   → Import Port
 *   → Warehouse
 *
 * Results are sorted by:
 * 1. Lowest risk score
 * 2. Lowest total delivery time
 * 3. Lowest cost
 */
export async function scoreAllRoutes(
  supplier: SupplierRouteInput,
  eventResult: EventRiskResult,
  targetWarehouseId?: string,
): Promise<ScoredRoute[]> {
  /**
   * Load supplier export ports.
   */
  const exportPortRows = await db
    .select({
      portId: supplierExportPorts.portId,
      isPrimary: supplierExportPorts.isPrimary,
    })
    .from(supplierExportPorts)
    .where(eq(supplierExportPorts.supplierId, supplier.id));

  if (exportPortRows.length === 0) {
    logger.warn(
      { supplierId: supplier.id },
      "No export ports configured for supplier",
    );

    return [];
  }

  /**
   * Load warehouses.
   */
  const warehouseRows = targetWarehouseId
    ? await db
        .select()
        .from(warehouses)
        .where(
          and(
            eq(warehouses.organizationId, supplier.organizationId),
            eq(warehouses.id, targetWarehouseId),
          ),
        )
    : await db
        .select()
        .from(warehouses)
        .where(eq(warehouses.organizationId, supplier.organizationId));

  if (warehouseRows.length === 0) {
    logger.warn(
      { supplierId: supplier.id },
      "No warehouses found for route scoring",
    );

    return [];
  }

  /**
   * Load only ports required by this calculation.
   */
  const requiredPortIds = [
    ...new Set([
      ...exportPortRows.map((row) => row.portId),
      ...warehouseRows
        .map((warehouse) => warehouse.importPortId)
        .filter((id): id is string => id !== null),
    ]),
  ];

  const relevantPorts = await db
    .select()
    .from(ports)
    .where(inArray(ports.id, requiredPortIds));

  const portMap = new Map(relevantPorts.map((port) => [port.id, port]));

  /**
   * Cache weather results to avoid
   * repeated API calls.
   */
  const weatherCache = new Map<string, WeatherRiskResult>();

  const scored: ScoredRoute[] = [];

  for (const exportPortRow of exportPortRows) {
    const exportPort = portMap.get(exportPortRow.portId);

    if (!exportPort) {
      continue;
    }

    for (const warehouse of warehouseRows) {
      if (!warehouse.importPortId) {
        continue;
      }

      const importPort = portMap.get(warehouse.importPortId);

      if (!importPort) {
        continue;
      }

      /**
       * Calculate operational risk.
       */
      const operational: OperationalRiskResult = scoreOperationalRisk({
        originLat: supplier.originLat,
        originLng: supplier.originLng,

        exportPortLat: exportPort.lat,
        exportPortLng: exportPort.lng,

        importPortLat: importPort.lat,
        importPortLng: importPort.lng,

        warehouseLat: warehouse.lat,
        warehouseLng: warehouse.lng,

        supplierLeadTimeDays: supplier.leadTimeDays,

        dependency: supplier.dependency,

        shippingRatePerKm: supplier.shippingRatePerKm,
      });

      /**
       * Route-specific weather.
       */
      const weatherKey = `${exportPort.id}:${warehouse.id}`;

      let weatherResult = weatherCache.get(weatherKey);

      if (!weatherResult) {
        weatherResult = await scoreCurrentWeather({
          originLat: supplier.originLat,
          originLng: supplier.originLng,

          exportPortLat: exportPort.lat,
          exportPortLng: exportPort.lng,

          importPortLat: importPort.lat,
          importPortLng: importPort.lng,

          warehouseLat: warehouse.lat,
          warehouseLng: warehouse.lng,
        });

        weatherCache.set(weatherKey, weatherResult);
      }

      const weatherScore = weatherResult.score;

      /**
       * Combine all risk dimensions.
       */
      const { score, level } = combinedScore(
        eventResult.score,
        operational.score,
        weatherScore,
      );

      scored.push({
        exportPortId: exportPort.id,
        exportPortName: exportPort.name,
        exportPortCountry: exportPort.country,

        importPortId: importPort.id,
        importPortName: importPort.name,
        importPortCountry: importPort.country,

        warehouseId: warehouse.id,
        warehouseName: warehouse.name,

        totalScore: score,
        riskLevel: level,

        leg1Km: operational.leg1Km,
        leg2Km: operational.leg2Km,
        leg3Km: operational.leg3Km,

        totalDistanceKm: operational.totalDistanceKm,

        transitDays: operational.transitDays,

        totalDeliveryDays: operational.totalDeliveryDays,

        estimatedCostUsd: operational.estimatedCostUsd,

        eventScore: eventResult.score,

        weatherScore,

        operationalScore: operational.score,
      });
    }
  }

  /**
   * Sort by:
   * risk → delivery time → cost
   */
  scored.sort((a, b) => {
    if (a.totalScore !== b.totalScore) {
      return a.totalScore - b.totalScore;
    }

    if (a.totalDeliveryDays !== b.totalDeliveryDays) {
      return a.totalDeliveryDays - b.totalDeliveryDays;
    }

    return a.estimatedCostUsd - b.estimatedCostUsd;
  });

  logger.info(
    {
      supplierId: supplier.id,
      routeCount: scored.length,
    },
    "All routes scored",
  );

  return scored;
}
