import { Router } from "express";
import { z } from "zod";
import { eq, and, gte, desc } from "drizzle-orm";

import { requireAuth, getOrgId } from "../middleware/auth";
import {
  createSupplier,
  getSuppliersByOrg,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from "../services/supplier.service";
import { getScoreHistory } from "../services/scoreHistory.service";
import { db } from "../database/drizzle";
import { riskEvents } from "../database/schema";
import { logger } from "../lib/logger";

const router = Router();

const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  tier: z.number().int().min(1).max(3),

  country: z.string().min(1),

  category: z.string().min(1),

  originAddress: z.string().min(5),

  leadTimeDays: z.number().int().positive(),

  dependency: z.enum(["low", "medium", "high", "sole_source"]),

  shippingRatePerKm: z.number().min(0),

  exportPortIds: z.array(z.string().uuid()).default([]),

  primaryPortId: z.string().uuid().optional(),
});

const UpdateSupplierSchema = CreateSupplierSchema.partial();

// Returns suppliers for the organization.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const suppliers = await getSuppliersByOrg(orgId);

    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

// Returns a supplier by ID.
router.get<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const supplier = await getSupplierById(req.params.id, orgId);

    if (!supplier) {
      res.status(404).json({
        error: "Supplier not found",
      });
      return;
    }

    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

// Returns score history for trend charts.
router.get<{ id: string }>(
  "/:id/history",
  requireAuth,
  async (req, res, next) => {
    try {
      const orgId = getOrgId(req);

      const supplier = await getSupplierById(req.params.id, orgId);

      if (!supplier) {
        res.status(404).json({
          error: "Supplier not found",
        });
        return;
      }

      const days = Math.min(365, Math.max(1, Number(req.query.days) || 40));

      const pastDays = Math.max(0, days - 10);

      const fromDate = new Date(Date.now() - pastDays * 86400_000)
        .toISOString()
        .split("T")[0];

      const toDate = new Date(Date.now() + 10 * 86400_000)
        .toISOString()
        .split("T")[0];

      const history = await getScoreHistory(
        req.params.id,
        orgId,
        fromDate,
        toDate,
      );

      res.json(history);
    } catch (err) {
      next(err);
    }
  },
);

// Returns supplier risk events.
router.get<{ id: string }>(
  "/:id/events",
  requireAuth,
  async (req, res, next) => {
    try {
      const orgId = getOrgId(req);

      const supplier = await getSupplierById(req.params.id, orgId);

      if (!supplier) {
        res.status(404).json({
          error: "Supplier not found",
        });
        return;
      }

      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));

      const fromDate = new Date(Date.now() - days * 86400_000);

      const events = await db
        .select()
        .from(riskEvents)
        .where(
          and(
            eq(riskEvents.supplierId, req.params.id),
            eq(riskEvents.organizationId, orgId),
            gte(riskEvents.createdAt, fromDate),
          ),
        )
        .orderBy(desc(riskEvents.createdAt));

      res.json(events);
    } catch (err) {
      next(err);
    }
  },
);

// Creates a supplier.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const body = CreateSupplierSchema.parse(req.body);

    const supplier = await createSupplier(orgId, body);

    logger.info(
      {
        supplierId: supplier.id,
        orgId,
      },
      "Supplier created",
    );

    res.status(201).json(supplier);
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

// Updates a supplier.
router.patch<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const body = UpdateSupplierSchema.parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({
        error: "No fields provided for update",
      });
      return;
    }

    const supplier = await updateSupplier(req.params.id, orgId, body);

    if (!supplier) {
      res.status(404).json({
        error: "Supplier not found",
      });
      return;
    }

    logger.info(
      {
        supplierId: req.params.id,
        orgId,
      },
      "Supplier updated",
    );

    res.json(supplier);
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

// Deletes a supplier.
router.delete<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const supplier = await getSupplierById(req.params.id, orgId);

    if (!supplier) {
      res.status(404).json({
        error: "Supplier not found",
      });
      return;
    }

    await deleteSupplier(req.params.id, orgId);

    logger.info(
      {
        supplierId: req.params.id,
        orgId,
      },
      "Supplier deleted",
    );

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
