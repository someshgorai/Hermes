import { db } from "../database/drizzle";
import { supplierScoreHistory } from "../database/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface ScoreValues {
  riskScore: number;
  eventScore: number;
  weatherScore: number;
  operationalScore: number;
  riskLevel: RiskLevel;
}

/**
 * Stores a daily supplier risk snapshot.
 * Uses database-level upsert (onConflictDoUpdate) on the unique
 * (supplierId, date, isForecast) constraint to avoid race conditions.
 */
export async function upsertScoreHistory(
  supplierId: string,
  organizationId: string,
  date: string,
  isForecast: boolean,
  scores: ScoreValues,
): Promise<void> {
  await db
    .insert(supplierScoreHistory)
    .values({
      supplierId,
      organizationId,
      date,
      isForecast,
      ...scores,
    })
    .onConflictDoUpdate({
      target: [
        supplierScoreHistory.supplierId,
        supplierScoreHistory.date,
        supplierScoreHistory.isForecast,
      ],
      set: scores,
    });
}

/** Returns score history used by the supplier risk trend chart. */
export async function getScoreHistory(
  supplierId: string,
  organizationId: string,
  fromDate: string,
  toDate: string,
) {
  return db
    .select()
    .from(supplierScoreHistory)
    .where(
      and(
        eq(supplierScoreHistory.supplierId, supplierId),
        eq(supplierScoreHistory.organizationId, organizationId),
        gte(supplierScoreHistory.date, fromDate),
        lte(supplierScoreHistory.date, toDate),
      ),
    )
    .orderBy(supplierScoreHistory.date);
}

/** Returns the latest non-forecast risk score. */
export async function getLatestScore(
  supplierId: string,
  organizationId: string,
) {
  const rows = await db
    .select()
    .from(supplierScoreHistory)
    .where(
      and(
        eq(supplierScoreHistory.supplierId, supplierId),
        eq(supplierScoreHistory.organizationId, organizationId),
        eq(supplierScoreHistory.isForecast, false),
      ),
    )
    .orderBy(desc(supplierScoreHistory.date))
    .limit(1);

  return rows[0] ?? null;
}
