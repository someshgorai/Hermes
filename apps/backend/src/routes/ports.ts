import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import {
  createPort,
  getAllPorts,
  getPortById,
  updatePort,
  deletePort,
  isPortReferenced,
} from "../services/port.service";
import { logger } from "../lib/logger";

const router = Router();

const CreatePortSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(1),
  address: z.string().min(1),
});

const UpdatePortSchema = CreatePortSchema.partial();

// Returns all ports.
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const ports = await getAllPorts();

    res.json(ports);
  } catch (err) {
    next(err);
  }
});

// Returns a port by ID.
router.get<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const port = await getPortById(req.params.id);

    if (!port) {
      res.status(404).json({
        error: "Port not found",
      });
      return;
    }

    res.json(port);
  } catch (err) {
    next(err);
  }
});

// Creates a port.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = CreatePortSchema.parse(req.body);

    const port = await createPort(body);

    logger.info(
      {
        portId: port.id,
      },
      "Port created",
    );

    res.status(201).json(port);
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

// Updates a port.
router.patch<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const body = UpdatePortSchema.parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({
        error: "No fields provided for update",
      });
      return;
    }

    const port = await updatePort(req.params.id, body);

    if (!port) {
      res.status(404).json({
        error: "Port not found",
      });
      return;
    }

    logger.info(
      {
        portId: req.params.id,
      },
      "Port updated",
    );

    res.json(port);
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

// PUT alias for port updates.
router.put<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const body = UpdatePortSchema.parse(req.body);

    if (Object.keys(body).length === 0) {
      res.status(400).json({
        error: "No fields provided for update",
      });
      return;
    }

    const port = await updatePort(req.params.id, body);

    if (!port) {
      res.status(404).json({
        error: "Port not found",
      });
      return;
    }

    logger.info(
      {
        portId: req.params.id,
      },
      "Port updated",
    );

    res.json(port);
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

// Deletes a port if it is not referenced.
router.delete<{ id: string }>("/:id", requireAuth, async (req, res, next) => {
  try {
    const refs = await isPortReferenced(req.params.id);

    if (refs.suppliers > 0 || refs.warehouses > 0) {
      res.status(400).json({
        error: `Cannot delete — port is used by ${refs.suppliers} suppliers and ${refs.warehouses} warehouses`,
      });
      return;
    }

    await deletePort(req.params.id);

    logger.info(
      {
        portId: req.params.id,
      },
      "Port deleted",
    );

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
