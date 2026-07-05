import { EmailOutbox } from "../models/EmailOutbox.js";
import { processEmailPayload, EmailJobPayload } from "../jobs/sendEmail.js";
import { logger } from "../utils/logger.js";

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 10000; // 10 seconds

export function startEmailWorker() {
  if (workerInterval) {
    logger.warn("Email worker is already running.");
    return;
  }

  logger.info("Starting native MongoDB Email Outbox worker...");

  workerInterval = setInterval(async () => {
    // Prevent overlapping runs if processing takes longer than 10 seconds
    if (isProcessing) return;

    try {
      isProcessing = true;

      // Atomically find one pending job and mark it as processing
      const job = await EmailOutbox.findOneAndUpdate(
        { status: "pending" },
        { $set: { status: "processing" } },
        { sort: { createdAt: 1 }, returnDocument: "after" }
      );

      if (!job) {
        // No pending jobs
        isProcessing = false;
        return;
      }

      try {
        // Construct payload mimicking the old Agenda structure
        const payload: EmailJobPayload = {
          recipientType: job.recipientType,
          type: job.type as any, // Cast to the specific string literal types
          tenantId: job.tenantId.toString(),
          customerId: job.customerId?.toString(),
          subscriptionId: job.subscriptionId?.toString(),
          invoiceId: job.invoiceId?.toString(),
          failureReason: job.failureReason,
          attemptNumber: job.attemptNumber,
          cancellationReason: job.cancellationReason,
          portalUrl: job.portalUrl,
        };

        // Process it
        await processEmailPayload(payload);

        // Mark completed
        await EmailOutbox.findByIdAndUpdate(job._id, {
          $set: { status: "completed" },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        logger.error({ jobId: job._id.toString(), error: errorMsg }, "Outbox email processing failed");

        const nextRetries = job.retries + 1;
        const nextStatus = nextRetries >= MAX_RETRIES ? "failed" : "pending";

        // Update retry count and status
        await EmailOutbox.findByIdAndUpdate(job._id, {
          $set: { 
            status: nextStatus,
            retries: nextRetries,
            lastError: errorMsg 
          },
        });
      }
    } catch (dbErr) {
      logger.error({ err: dbErr instanceof Error ? dbErr.message : "Unknown" }, "Database error in email worker");
    } finally {
      isProcessing = false;
    }
  }, POLL_INTERVAL_MS);
}

export function stopEmailWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info("Email Outbox worker stopped.");
  }
}
