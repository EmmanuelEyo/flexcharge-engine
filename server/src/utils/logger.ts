import pino from "pino";
import { env } from "../config/environment.js";

/**
 * Structured JSON logger using Pino.
 *
 * In development: pretty-prints logs with colors and timestamps.
 * In production: outputs raw JSON for log aggregation services.
 *
 * SECURITY: Never log sensitive data (tokens, API keys, card info).
 * Use the `redact` option to automatically strip sensitive fields.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "password",
      "passwordHash",
      "tokenKey",
      "apiKey",
      "webhookSecret",
    ],
    censor: "[REDACTED]",
  },
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});
