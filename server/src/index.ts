// Types in src/types/express.d.ts are picked up automatically by TypeScript
import { env } from "./config/environment.js";
import { connectDatabase } from "./config/database.js";
import { startAgenda, stopAgenda } from "./config/agenda.js";
import { logger } from "./utils/logger.js";
import app from "./app.js";

/**
 * Server Entry Point
 *
 * Startup sequence:
 * 1. Load & validate environment variables (crashes if invalid)
 * 2. Connect to MongoDB
 * 3. Start Agenda job scheduler
 * 4. Start Express HTTP server
 *
 * Shutdown sequence (on SIGTERM/SIGINT):
 * 1. Stop accepting new requests
 * 2. Stop Agenda scheduler
 * 3. Close server
 */

async function main(): Promise<void> {
  try {
    // Step 1: Connect to MongoDB
    await connectDatabase();

    // Step 2: Start the job scheduler
    await startAgenda();

    // Step 3: Start the HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV,
          url: `http://localhost:${env.PORT}`,
        },
        `🚀 FlexCharge Engine running on port ${env.PORT}`
      );
    });

    // ===== GRACEFUL SHUTDOWN =====
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");

      // Stop accepting new connections
      server.close(async () => {
        logger.info("HTTP server closed");

        // Stop job scheduler
        await stopAgenda();

        // Exit cleanly
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error("Forced exit after shutdown timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Catch unhandled rejections
    process.on("unhandledRejection", (reason) => {
      logger.fatal({ reason }, "Unhandled promise rejection");
      process.exit(1);
    });

    process.on("uncaughtException", (error) => {
      logger.fatal({ error }, "Uncaught exception");
      process.exit(1);
    });
  } catch (error) {
    logger.fatal({ error }, "Failed to start server");
    process.exit(1);
  }
}

main();
