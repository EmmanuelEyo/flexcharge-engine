import mongoose from "mongoose";
import { env } from "./environment.js";
import { logger } from "../utils/logger.js";

/**
 * Connect to MongoDB with sensible production defaults.
 * Mongoose 9 uses the new connection string parser and unified topology by default.
 */
export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    const connection = await mongoose.connect(env.MONGO_URL, {
      // Automatically build indexes defined in schemas
      autoIndex: env.NODE_ENV !== "production",
    });

    logger.info(
      { host: connection.connection.host, name: connection.connection.name },
      "✅ MongoDB connected"
    );

    // Handle connection errors after initial connection
    mongoose.connection.on("error", (err) => {
      logger.error({ err }, "MongoDB connection error");
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return connection;
  } catch (error) {
    logger.fatal({ error }, "❌ Failed to connect to MongoDB");
    process.exit(1);
  }
}
