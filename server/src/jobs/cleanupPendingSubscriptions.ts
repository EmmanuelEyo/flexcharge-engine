import { Agenda } from "agenda";
import { Subscription } from "../models/Subscription.js";
import { logger } from "../utils/logger.js";

export const CLEANUP_PENDING_SUBS_JOB_NAME = "cleanup-pending-subscriptions";

/**
 * Job: cleanup-pending-subscriptions
 * 
 * Runs every hour to find and delete "pending" subscriptions 
 * that were created more than 24 hours ago.
 * This keeps the database clean from abandoned checkout attempts.
 */
export function defineCleanupPendingSubscriptionsJob(agenda: Agenda): void {
  agenda.define(CLEANUP_PENDING_SUBS_JOB_NAME, async (job) => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find pending subscriptions older than 24 hours
      const result = await Subscription.deleteMany({
        status: "pending",
        createdAt: { $lt: twentyFourHoursAgo },
      });

      if (result.deletedCount > 0) {
        logger.info(
          { deletedCount: result.deletedCount },
          "Cleaned up abandoned pending subscriptions"
        );
      }
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : "Unknown" },
        "Failed to clean up pending subscriptions"
      );
      throw error;
    }
  });
}
