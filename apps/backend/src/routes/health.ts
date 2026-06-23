import { Router } from "express";

const router = Router();

// Confirms the API process is running.
router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "hermes-api",
    timestamp: new Date().toISOString(),
  });
});

export default router;
