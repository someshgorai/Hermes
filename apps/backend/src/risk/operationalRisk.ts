import { logger } from "../lib/logger";

export type DependencyLevel = "low" | "medium" | "high" | "sole_source";

// dependency severity — sole-source is worst since there's no backup
const DEPENDENCY_SEVERITY: Record<DependencyLevel, number> = {
  low: 0.1,
  medium: 0.4,
  high: 0.7,
  sole_source: 1.0,
};

// maps total delivery time (lead + transit) to a severity score
const DELIVERY_TIME_SEVERITY = (days: number): number => {
  return days <= 7 ? 0.1 : days <= 14 ? 0.3 : days <= 30 ? 0.6 : 0.9;
};

// maps route distance to severity — longer routes = more risk
const DISTANCE_SEVERITY = (km: number): number => {
  return km < 500 ? 0.1 : km < 2000 ? 0.3 : km < 5000 ? 0.6 : 0.9;
};

// sanity-checks lat/lng before route calls (catches geocoding failures)
function validateCoordinates(lat: number, lng: number, field: string): void {
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error(`Invalid coordinates for ${field}`);
  }

  if (lat === 0 && lng === 0) {
    logger.warn({ field }, "Coordinates are 0,0 - possible geocoding failure");
  }
}

// haversine distance between two points — good enough for logistics estimates
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// input for operational risk — full route: supplier → export port → import port → warehouse
export interface OperationalRiskInput {
  originLat: number;
  originLng: number;

  exportPortLat: number;
  exportPortLng: number;

  importPortLat: number;
  importPortLng: number;

  warehouseLat: number;
  warehouseLng: number;

  // Time required by supplier before goods are ready for shipment.
  supplierLeadTimeDays: number;

  dependency: DependencyLevel;

  // USD
  shippingRatePerKm: number;
}

export interface OperationalRiskResult {
  score: number;

  leg1Km: number;
  leg2Km: number;
  leg3Km: number;

  totalDistanceKm: number;

  // Transportation time only.
  transitDays: number;

  // Supplier lead time + transit time
  totalDeliveryDays: number;

  estimatedCostUsd: number;
}


// Calculates operational risk for a complete supply-chain route//
// Risk is derived from:
// - Route distance
// - Total delivery time
// - Supplier dependency concentration
// Returns a normalized score between 0 and 100.

export function scoreOperationalRisk(
  input: OperationalRiskInput,
): OperationalRiskResult {
  validateCoordinates(input.originLat, input.originLng, "supplier_origin");

  validateCoordinates(input.exportPortLat, input.exportPortLng, "export_port");

  validateCoordinates(input.importPortLat, input.importPortLng, "import_port");

  validateCoordinates(input.warehouseLat, input.warehouseLng, "warehouse");

  const leg1Km = haversineKm(
    input.originLat,
    input.originLng,
    input.exportPortLat,
    input.exportPortLng,
  );

  const leg2Km = haversineKm(
    input.exportPortLat,
    input.exportPortLng,
    input.importPortLat,
    input.importPortLng,
  );

  const leg3Km = haversineKm(
    input.importPortLat,
    input.importPortLng,
    input.warehouseLat,
    input.warehouseLng,
  );

  const totalDistanceKm = leg1Km + leg2Km + leg3Km;

  // Transit assumptions used for route comparison.
  // Road segments: ~250 km/day
  // Sea segment: ~400 km/day
  const transitDays = Math.ceil(leg1Km / 250 + leg2Km / 400 + leg3Km / 250);

  const totalDeliveryDays = input.supplierLeadTimeDays + transitDays;

  const estimatedCostUsd = Number(
    (totalDistanceKm * input.shippingRatePerKm).toFixed(2),
  );

  const distanceSeverity = DISTANCE_SEVERITY(totalDistanceKm);

  const deliveryTimeSeverity = DELIVERY_TIME_SEVERITY(totalDeliveryDays);

  const dependencySeverity = DEPENDENCY_SEVERITY[input.dependency];

  const rawScore =
    distanceSeverity * 0.3 +
    deliveryTimeSeverity * 0.3 +
    dependencySeverity * 0.4;

  const score = Math.min(100, Math.round(rawScore * 100));

  logger.debug(
    {
      totalDistanceKm: Math.round(totalDistanceKm),
      transitDays,
      totalDeliveryDays,
      estimatedCostUsd,
      score,
    },
    "Operational risk scored",
  );

  return {
    score,

    leg1Km: Math.round(leg1Km),
    leg2Km: Math.round(leg2Km),
    leg3Km: Math.round(leg3Km),

    totalDistanceKm: Math.round(totalDistanceKm),

    transitDays,
    totalDeliveryDays,

    estimatedCostUsd,
  };
}

// blends event, operational, and weather risk into one score (0–100)
// event risk gets the biggest weight since real disruptions hit hardest
export function combinedScore(
  eventScore: number,
  operationalScore: number,
  weatherScore: number,
): {
  score: number;
  level: "low" | "medium" | "high" | "critical";
} {
  const score = Math.round(
    eventScore * 0.5 + operationalScore * 0.3 + weatherScore * 0.2,
  );

  const clamped = Math.min(100, Math.max(0, score));

  const level =
    clamped < 30
      ? "low"
      : clamped < 55
        ? "medium"
        : clamped < 75
          ? "high"
          : "critical";

  return {
    score: clamped,
    level,
  };
}
