import { db } from "../database/drizzle";
import { alerts } from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import type { RiskType } from "../risk/eventRisk";

/** Creates a supplier alert when significant risk is detected. */
export async function createAlert(data: {
  organizationId: string;
  supplierId: string;
  message: string;
  riskType: RiskType;
}) {
  const [alert] = await db.insert(alerts).values(data).returning();

  return alert;
}

/**
 * Returns active alerts for an organization.
 * Dismissed alerts are excluded from operational views.
 */
export async function getAlertsByOrg(organizationId: string) {
  return db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.organizationId, organizationId),
        eq(alerts.isDismissed, false),
      ),
    )
    .orderBy(desc(alerts.createdAt));
}

/**
 * Returns the complete alert history,
 * including dismissed alerts.
 */
export async function getAllAlertsByOrg(organizationId: string) {
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.organizationId, organizationId))
    .orderBy(desc(alerts.createdAt));
}

/**
 * Marks an alert as dismissed without deleting it.
 * Historical alerts remain available for auditing.
 */
export async function dismissAlert(id: string, organizationId: string) {
  const [alert] = await db
    .update(alerts)
    .set({
      isDismissed: true,
      updatedAt: new Date(),
    })
    .where(and(eq(alerts.id, id), eq(alerts.organizationId, organizationId)))
    .returning();

  return alert;
}

/** Dismisses all active alerts for an organization. */
export async function dismissAllAlerts(organizationId: string) {
  await db
    .update(alerts)
    .set({
      isDismissed: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(alerts.organizationId, organizationId),
        eq(alerts.isDismissed, false),
      ),
    );
}
