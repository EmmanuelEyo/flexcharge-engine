import { Agenda } from "agenda";
import {
  findDueSubscriptions,
  processRenewal,
  processCancelAtPeriodEnd,
  sendUpcomingRenewalReminders,
} from "../services/billing.service.js";
import { logger } from "../utils/logger.js";

/**
 * Daily Billing Scan — Agenda job that finds and charges due subscriptions.
 *
 * Per overall_implementation_plan.md §6.2:
 * "Agenda: dailyBillingScan runs every hour"
 * - Query: subscriptions WHERE nextBillingDate <= NOW AND status = 'active'
 * - For each: create invoice, charge tokenized card, advance dates
 *
 * Also handles cancel-at-period-end processing.
 */

export const DAILY_BILLING_SCAN_JOB_NAME = "daily-billing-scan";

export function defineDailyBillingScanJob(agenda: Agenda): void {
  agenda.define(DAILY_BILLING_SCAN_JOB_NAME, async (_job) => {
    logger.info("Starting daily billing scan");

    try {
      // 1. Send advance renewal reminders for manual subscriptions
      const reminderCount = await sendUpcomingRenewalReminders();
      if (reminderCount > 0) {
        logger.info(
          { reminderCount },
          "Sent upcoming renewal reminders for manual subscriptions"
        );
      }

      // 2. Process cancel-at-period-end subscriptions
      const canceledCount = await processCancelAtPeriodEnd();
      if (canceledCount > 0) {
        logger.info(
          { canceledCount },
          "Processed cancel-at-period-end subscriptions"
        );
      }

      // 2. Find and charge due subscriptions
      const dueSubscriptions = await findDueSubscriptions();

      if (dueSubscriptions.length === 0) {
        logger.debug("No subscriptions due for renewal");
        return;
      }

      logger.info(
        { count: dueSubscriptions.length },
        "Found subscriptions due for renewal"
      );

      let successCount = 0;
      let failureCount = 0;

      for (const subscription of dueSubscriptions) {
        try {
          const result = await processRenewal(subscription._id);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          logger.error(
            {
              subscriptionId: subscription._id,
              error:
                error instanceof Error ? error.message : "Unknown error",
            },
            "Unexpected error processing subscription renewal"
          );
        }
      }

      logger.info(
        { total: dueSubscriptions.length, successCount, failureCount },
        "Daily billing scan completed"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Daily billing scan failed"
      );
    }
  });
}
