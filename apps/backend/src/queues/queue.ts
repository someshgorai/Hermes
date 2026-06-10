import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { logger } from "../lib/logger";
import "dotenv/config";

const redisUrl = process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error("UPSTASH_REDIS_URL is not defined");
}

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
});

connection.on("connect", () => {
  logger.info("Redis connected");
});

connection.on("ready", () => {
  logger.info("Redis ready");
});

connection.on("close", () => {
  logger.warn("Redis connection closed");
});

connection.on("reconnecting", () => {
  logger.warn("Redis reconnecting");
});

connection.on("end", () => {
  logger.warn("Redis connection ended");
});

connection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

export const analysisQueue = new Queue("supplier-analysis", {
  connection: connection as any,
  prefix: "hermes",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
