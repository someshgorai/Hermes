import cron from "node-cron";

import { analysisQueue } from "../queues/queue";
import { getAllSuppliersAcrossOrgs } from "../services/supplier.service";
import { logger } from "../lib/logger";

// Starts scheduled background jobs.
export function startScheduledJobs(): void {
  cron.schedule(
    "0 0 * * *",
    async () => {
      logger.info("Midnight cron started");

      try {
        const allSuppliers = await getAllSuppliersAcrossOrgs();

        if (allSuppliers.length === 0) {
          logger.info("No suppliers found for nightly analysis");
          return;
        }

        await analysisQueue.addBulk(
          allSuppliers.map((supplier, index) => ({
            name: "analyze",
            data: {
              supplierId: supplier.id,
              organizationId: supplier.organizationId,
              supplierName: supplier.name,
              country: supplier.country,
              warehouseId: undefined,
            },
            opts: {
              delay: index * 60_000, // stagger by 60s per supplier to avoid rate limits
              attempts: 3,
              backoff: {
                type: "exponential",
                delay: 5_000,
              },
            },
          })),
        );

        logger.info(
          {
            supplierCount: allSuppliers.length,
          },
          "Nightly analysis jobs queued",
        );
      } catch (err) {
        logger.error({ err }, "Nightly cron job failed");
      }
    },
    {
      timezone: "UTC",
    },
  );

  logger.info("Scheduled jobs initialized");
}
