import { Router } from "express";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";

import { requireAuth, getOrgId } from "../middleware/auth";
import { getSupplierById } from "../services/supplier.service";
import { analysisQueue } from "../queues/queue";
import { db } from "../database/drizzle";
import { routeScores, ports, warehouses } from "../database/schema";
import { logger } from "../lib/logger";
import { alias } from "drizzle-orm/pg-core";

const router = Router();

const RunAnalysisSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
});

// Enqueues a supplier risk analysis job.
router.post("/run", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const { supplierId, warehouseId } = RunAnalysisSchema.parse(req.body);

    const supplier = await getSupplierById(supplierId, orgId);

    if (!supplier) {
      res.status(404).json({
        error: "Supplier not found",
      });
      return;
    }

    const job = await analysisQueue.add("analyze", {
      supplierId,
      organizationId: orgId,
      supplierName: supplier.name,
      country: supplier.country,
      warehouseId,
    });

    logger.info(
      {
        jobId: job.id,
        supplierId,
        orgId,
      },
      "Analysis job enqueued",
    );

    res.json({
      jobId: String(job.id),
      message: "Analysis started. Updates will arrive via WebSocket.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: err.issues,
      });
      return;
    }

    next(err);
  }
});

// Returns saved route scores for a supplier.
router.get<{ supplierId: string }>(
  "/routes/:supplierId",
  requireAuth,
  async (req, res, next) => {
    try {
      const orgId = getOrgId(req);

      const supplier = await getSupplierById(req.params.supplierId, orgId);

      if (!supplier) {
        res.status(404).json({
          error: "Supplier not found",
        });
        return;
      }

      const exportPortsAlias = alias(ports, "export_ports");
      const importPortsAlias = alias(ports, "import_ports");

      const warehouseId = req.query.warehouseId as string | undefined;

      const conditions = [
        eq(routeScores.supplierId, req.params.supplierId),
        eq(routeScores.organizationId, orgId),
      ];

      if (warehouseId) {
        conditions.push(eq(routeScores.warehouseId, warehouseId));
      }

      const routes = await db
        .select({
          id: routeScores.id,
          organizationId: routeScores.organizationId,
          supplierId: routeScores.supplierId,
          exportPortId: routeScores.exportPortId,
          exportPortName: exportPortsAlias.name,
          exportPortCountry: exportPortsAlias.country,
          importPortId: routeScores.importPortId,
          importPortName: importPortsAlias.name,
          importPortCountry: importPortsAlias.country,
          warehouseId: routeScores.warehouseId,
          warehouseName: warehouses.name,
          totalScore: routeScores.totalScore,
          riskLevel: routeScores.riskLevel,
          leg1Km: routeScores.leg1Km,
          leg2Km: routeScores.leg2Km,
          leg3Km: routeScores.leg3Km,
          totalDistanceKm: routeScores.totalDistanceKm,
          transitDays: routeScores.transitDays,
          totalDeliveryDays: routeScores.totalDeliveryDays,
          estimatedCostUsd: routeScores.estimatedCostUsd,
          eventScore: routeScores.eventScore,
          weatherScore: routeScores.weatherScore,
          operationalScore: routeScores.operationalScore,
          createdAt: routeScores.createdAt,
          updatedAt: routeScores.updatedAt,
        })
        .from(routeScores)
        .innerJoin(exportPortsAlias, eq(routeScores.exportPortId, exportPortsAlias.id))
        .innerJoin(importPortsAlias, eq(routeScores.importPortId, importPortsAlias.id))
        .innerJoin(warehouses, eq(routeScores.warehouseId, warehouses.id))
        .where(and(...conditions))
        .orderBy(asc(routeScores.totalScore));

      res.json(routes);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
