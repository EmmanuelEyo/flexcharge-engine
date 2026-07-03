import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { stopAgenda } from "../config/agenda.js";

let mongoServer: MongoMemoryServer;

/**
 * Start the in-memory MongoDB server and connect Mongoose.
 */
export async function setupTestDB(): Promise<void> {
  // If we already have a connection, do nothing
  if (mongoose.connection.readyState !== 0) {
    return;
  }

  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

/**
 * Close database connection and stop the in-memory server.
 */
export async function teardownTestDB(): Promise<void> {
  await stopAgenda();
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Clear all collections between test cases to ensure isolation.
 */
export async function clearTestDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
}
