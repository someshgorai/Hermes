import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import pinoHttp from "pino-http";

import { logger } from "./lib/logger";
import { initSocket } from "./socket";
import { startScheduledJobs } from "./jobs/schedule";
import { handleAuthError } from "./middleware/auth";

import "./workers/analysis-worker";

// Route registration
import healthRouter from "./routes/health";
import suppliersRouter from "./routes/suppliers";
import warehousesRouter from "./routes/warehouses";
import portsRouter from "./routes/ports";
import analysisRouter from "./routes/analysis";
import alertsRouter from "./routes/alerts";
import recommendationsRouter from "./routes/recommendations";
import { clerkMiddleware } from "@clerk/express";

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.use(clerkMiddleware());

app.use(
  pinoHttp({
    logger,
  }),
);

// Routes
app.use("/api/warehouses", warehousesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/health", healthRouter);
app.use("/api/ports", portsRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/recommendations", recommendationsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
  });
});

// Authentication error handler
app.use(handleAuthError);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled error");

    const isDevelopment = process.env.NODE_ENV !== "production";

    res.status(500).json({
      error: isDevelopment ? err.message : "Internal server error",
    });
  },
);

// Socket.io
initSocket(httpServer);

// Scheduled jobs
startScheduledJobs();

const PORT = Number(process.env.PORT ?? 3001);

if (Number.isNaN(PORT)) {
  throw new Error("Invalid PORT value");
}

// Start server
httpServer.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
    },
    "Hermes API started",
  );
});

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received");

  httpServer.close(() => {
    logger.info("HTTP server closed");

    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
