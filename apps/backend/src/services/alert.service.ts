import { db } from "../database/drizzle";
import { alerts } from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import type { RiskType } from "../risk/eventRisk";

// creates an alert when we detect significant risk for a supplier
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

// grabs the full alert history, including dismissed ones
export async function getAllAlertsByOrg(organizationId: string) {
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.organizationId, organizationId))
    .orderBy(desc(alerts.createdAt));
}

// soft-dismiss — keeps the alert around for audit history
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

// bulk-dismiss every active alert for the org
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
