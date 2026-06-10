import { Router } from "express";
import { z } from "zod";
import { requireAuth, getOrgId } from "../middleware/auth";
import {
  createWarehouse,
  getWarehousesByOrg,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
} from "../services/warehouse.service";
import { logger } from "../lib/logger";

const router = Router();

const CreateWarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(5),
  country: z.string().min(1),
  importPortId: z.string().uuid().optional(),
});

const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

// GET /warehouses — list all warehouses for the org
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    res.json(await getWarehousesByOrg(orgId));
  } catch (err) {
    next(err);
  }
});

// GET /warehouses/:id
router.get<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const warehouse = await getWarehouseById(req.params.id, orgId);
    if (!warehouse) {
      res.status(404).json({ error: "Warehouse not found" });
      return;
    }
    res.json(warehouse);
  } catch (err) {
    next(err);
  }
});

// POST /warehouses — create warehouse
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const body = CreateWarehouseSchema.parse(req.body);
    const warehouse = await createWarehouse(orgId, body);
    logger.info({ warehouseId: warehouse.id, orgId }, "Warehouse created");
    res.status(201).json(warehouse);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues });
      return;
    }
    next(err);
  }
});

// PATCH /warehouses/:id
router.patch<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const body = UpdateWarehouseSchema.parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const warehouse = await updateWarehouse(req.params.id, orgId, body);

    if (!warehouse) {
      res.status(404).json({ error: "Warehouse not found" });
      return;
    }

    res.json(warehouse);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues });
      return;
    }
    next(err);
  }
});

// DELETE /warehouses/:id
router.delete<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const orgId = getOrgId(req);

    const warehouse = await getWarehouseById(req.params.id, orgId);

    if (!warehouse) {
      res.status(404).json({ error: "Warehouse not found" });
      return;
    }

    await deleteWarehouse(req.params.id, orgId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
