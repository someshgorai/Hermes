import { db } from "../database/drizzle";
import { recommendations } from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import type { SmartRecommendation } from "../risk/smartRouter";

// saves a new route optimization recommendation to the db
export async function createRecommendation(
  organizationId: string,
  supplierId: string,
  rec: SmartRecommendation,
) {
  type RiskLevel = "low" | "medium" | "high" | "critical";

  const [inserted] = await db
    .insert(recommendations)
    .values({
      organizationId,
      supplierId,

      currentExportPortId: rec.currentExportPortId,
      currentImportPortId: rec.currentImportPortId,
      currentWarehouseId: rec.currentWarehouseId,
      currentRiskLevel: rec.currentRiskLevel as RiskLevel,

      suggestedExportPortId: rec.suggestedExportPortId,
      suggestedImportPortId: rec.suggestedImportPortId,
      suggestedWarehouseId: rec.suggestedWarehouseId,
      suggestedRiskLevel: rec.suggestedRiskLevel as RiskLevel,

      reason: rec.reason,

      extraDistanceKm: rec.extraDistanceKm,
      extraCostUsd: rec.extraCostUsd,
      extraDays: rec.extraDays,

      exportPortRank: rec.exportPortRank,

      importPortRank: rec.importPortRank,

      warehouseRank: rec.warehouseRank,
    })
    .returning();

  return inserted;
}

/**
 * Returns active recommendations for an organization.
 * Filters out anything already accepted or dismissed.
 */
export async function getRecommendationsByOrg(organizationId: string) {
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.organizationId, organizationId),
        eq(recommendations.isDismissed, false),
        eq(recommendations.isAccepted, false),
      ),
    )
    .orderBy(desc(recommendations.createdAt));
}

// marks a recommendation as accepted
export async function acceptRecommendation(id: string, organizationId: string) {
  const [recommendation] = await db
    .update(recommendations)
    .set({
      isAccepted: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recommendations.id, id),
        eq(recommendations.organizationId, organizationId),
      ),
    )
    .returning();

  return recommendation;
}

// marks a recommendation as dismissed
export async function dismissRecommendation(
  id: string,
  organizationId: string,
) {
  const [recommendation] = await db
    .update(recommendations)
    .set({
      isDismissed: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recommendations.id, id),
        eq(recommendations.organizationId, organizationId),
      ),
    )
    .returning();

  return recommendation;
}
