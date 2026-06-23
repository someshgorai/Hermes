import pino from "pino";
import dotenv from "dotenv";
dotenv.config();

// Pino logger singleton. Use this everywhere instead of console.log.
export const logger = pino({
  level: "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
