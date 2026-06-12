import type { ScoredRoute } from "./routeScorer";
import { logger } from "../lib/logger";

// a ranked routing option for an export port, import port, or warehouse
export interface RankedOption {
  id: string;
  name: string;
  score: number;
  riskLevel: string;
  totalDeliveryDays: number;
  estimatedCostUsd: number;
  reason: string;
}

// route optimization recommendation from all evaluated supplier routes
export interface SmartRecommendation {
  currentExportPortId: string | null;
  currentImportPortId: string | null;
  currentWarehouseId: string | null;
  currentRiskLevel: string;

  suggestedExportPortId: string;
  suggestedImportPortId: string;
  suggestedWarehouseId: string;
  suggestedRiskLevel: string;

  reason: string;

  extraDistanceKm: number;
  extraCostUsd: number;
  extraDays: number;

  exportPortRank: RankedOption[];
  importPortRank: RankedOption[];
  warehouseRank: RankedOption[];
}

// don't bother recommending a change unless it improves the score by at least this much
const MIN_IMPROVEMENT_POINTS = 10;

// builds a human-readable reason for the recommended route
function buildReason(best: ScoredRoute, current: ScoredRoute | null): string {
  const parts: string[] = [];

  if (best.riskLevel === "low") {
    parts.push("Low overall supply chain risk");
  } else if (best.riskLevel === "medium") {
    parts.push("Moderate and manageable risk profile");
  }

  if (best.eventScore < 20) {
    parts.push("minimal news-driven disruptions");
  }

  if (best.weatherScore < 20) {
    parts.push("clear weather forecast across all route segments");
  }

  if (best.operationalScore < 30) {
    parts.push("efficient delivery route");
  }

  if (current && best.totalDeliveryDays < current.totalDeliveryDays) {
    parts.push(
      `${
        current.totalDeliveryDays - best.totalDeliveryDays
      } day(s) faster than current route`,
    );
  }

  return parts.length > 0
    ? `${parts.join(", ")}.`
    : "Best available route based on current risk, weather, and delivery performance.";
}

// picks the best-scoring route per export port
function rankExportPorts(routes: ScoredRoute[]): RankedOption[] {
  const map = new Map<string, ScoredRoute>();

  for (const route of routes) {
    const existing = map.get(route.exportPortId);

    if (!existing || route.totalScore < existing.totalScore) {
      map.set(route.exportPortId, route);
    }
  }

  return [...map.values()]
    .sort((a, b) => a.totalScore - b.totalScore)
    .map((route) => ({
      id: route.exportPortId,
      name: route.exportPortName,
      score: route.totalScore,
      riskLevel: route.riskLevel,
      totalDeliveryDays: route.totalDeliveryDays,
      estimatedCostUsd: route.estimatedCostUsd,
      reason: `${route.exportPortCountry} export port`,
    }));
}

// picks the best-scoring route per import port
function rankImportPorts(routes: ScoredRoute[]): RankedOption[] {
  const map = new Map<string, ScoredRoute>();

  for (const route of routes) {
    const existing = map.get(route.importPortId);

    if (!existing || route.totalScore < existing.totalScore) {
      map.set(route.importPortId, route);
    }
  }

  return [...map.values()]
    .sort((a, b) => a.totalScore - b.totalScore)
    .map((route) => ({
      id: route.importPortId,
      name: route.importPortName,
      score: route.totalScore,
      riskLevel: route.riskLevel,
      totalDeliveryDays: route.totalDeliveryDays,
      estimatedCostUsd: route.estimatedCostUsd,
      reason: `${route.importPortCountry} import port`,
    }));
}

// picks the best-scoring route per warehouse
function rankWarehouses(routes: ScoredRoute[]): RankedOption[] {
  const map = new Map<string, ScoredRoute>();

  for (const route of routes) {
    const existing = map.get(route.warehouseId);

    if (!existing || route.totalScore < existing.totalScore) {
      map.set(route.warehouseId, route);
    }
  }

  return [...map.values()]
    .sort((a, b) => a.totalScore - b.totalScore)
    .map((route) => ({
      id: route.warehouseId,
      name: route.warehouseName,
      score: route.totalScore,
      riskLevel: route.riskLevel,
      totalDeliveryDays: route.totalDeliveryDays,
      estimatedCostUsd: route.estimatedCostUsd,
      reason: `Via ${route.importPortName}`,
    }));
}

/**
 * Identifies the lowest-risk route and determines
 * whether it provides a meaningful improvement
 * over the current route.
 */
export function findBestRoute(
  allRoutes: ScoredRoute[],
  currentRoute: ScoredRoute | null,
): SmartRecommendation | null {
  if (allRoutes.length === 0) {
    logger.warn("No routes to evaluate in smart router");

    return null;
  }

  const best = allRoutes[0];

  if (currentRoute) {
    const improvement = currentRoute.totalScore - best.totalScore;

    if (improvement < MIN_IMPROVEMENT_POINTS) {
      logger.info(
        {
          currentScore: currentRoute.totalScore,
          bestScore: best.totalScore,
          improvement,
        },
        "Current route already optimal — no recommendation needed",
      );

      return null;
    }
  }

  const exportPortRank = rankExportPorts(allRoutes);

  const importPortRank = rankImportPorts(allRoutes);

  const warehouseRank = rankWarehouses(allRoutes);

  const recommendation: SmartRecommendation = {
    currentExportPortId: currentRoute?.exportPortId ?? null,

    currentImportPortId: currentRoute?.importPortId ?? null,

    currentWarehouseId: currentRoute?.warehouseId ?? null,

    currentRiskLevel: currentRoute?.riskLevel ?? "unknown",

    suggestedExportPortId: best.exportPortId,

    suggestedImportPortId: best.importPortId,

    suggestedWarehouseId: best.warehouseId,

    suggestedRiskLevel: best.riskLevel,

    reason: buildReason(best, currentRoute),

    extraDistanceKm: currentRoute
      ? best.totalDistanceKm - currentRoute.totalDistanceKm
      : 0,

    extraCostUsd: currentRoute
      ? best.estimatedCostUsd - currentRoute.estimatedCostUsd
      : 0,

    extraDays: currentRoute
      ? best.totalDeliveryDays - currentRoute.totalDeliveryDays
      : 0,

    exportPortRank,
    importPortRank,
    warehouseRank,
  };

  logger.info(
    {
      suggestedRoute: `${best.exportPortName} → ${best.importPortName} → ${best.warehouseName}`,
    },
    "Smart route recommendation generated",
  );

  return recommendation;
}
