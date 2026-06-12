import { Queue, type ConnectionOptions } from "bullmq";
import "dotenv/config";

const redisUrl = process.env.UPSTASH_REDIS_URL;

if (!redisUrl) {
  throw new Error("UPSTASH_REDIS_URL is not defined");
}

export const queueConnection: ConnectionOptions = {
  url: redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: {},
};

export const analysisQueue = new Queue("supplier-analysis", {
  connection: queueConnection,
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
