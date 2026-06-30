import { Agenda } from "agenda";
import { Types } from "mongoose";
import { DunningAttempt } from "../models/DunningAttempt.js";
import { processDunningRetry } from "../services/dunning.service.js";
import { logger } from "../utils/logger.js";

/**
 * Dunning Retry Job — Processes scheduled dunning retry attempts.
 *
 * Per overall_implementation_plan.md §6.3:
 * "Agenda: dunningRetry job fires → load subscription → charge card"
 *
 * This job runs every 5 minutes and picks up DunningAttempt records
 * that are "scheduled" and whose scheduledFor date has passed.
 */

export const DUNNING_RETRY_JOB_NAME = "dunning-retry-scan";

export function defineDunningRetryJob(agenda: Agenda): void {
  agenda.define(DUNNING_RETRY_JOB_NAME, async (_job) => {
    try {
      const now = new Date();

      // Find all scheduled dunning attempts that are due
      const dueAttempts = await DunningAttempt.find({
        status: "scheduled",
        scheduledFor: { $lte: now },
      }).limit(50); // Process max 50 per run to avoid overloading

      if (dueAttempts.length === 0) {
        logger.debug("No dunning retries due");
        return;
      }

      logger.info(
        { count: dueAttempts.length },
        "Processing due dunning retry attempts"
      );

      let successCount = 0;
      let failureCount = 0;

      for (const attempt of dueAttempts) {
        try {
          const result = await processDunningRetry(
            attempt._id as Types.ObjectId
          );
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          logger.error(
            {
              dunningAttemptId: attempt._id,
              error:
                error instanceof Error ? error.message : "Unknown error",
            },
            "Unexpected error processing dunning retry"
          );
        }
      }

      logger.info(
        { total: dueAttempts.length, successCount, failureCount },
        "Dunning retry scan completed"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Dunning retry scan failed"
      );
    }
  });
}
