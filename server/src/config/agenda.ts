import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import mongoose from "mongoose";
import { env } from "./environment.js";
import { logger } from "../utils/logger.js";
import { defineWebhookJobs } from "../jobs/webhookDelivery.js";
import { defineTokenRefreshJob, TOKEN_REFRESH_JOB_NAME } from "../jobs/tokenRefresh.js";
import { defineDailyBillingScanJob, DAILY_BILLING_SCAN_JOB_NAME } from "../jobs/dailyBillingScan.js";
import { defineDunningRetryJob, DUNNING_RETRY_JOB_NAME } from "../jobs/dunningRetry.js";
import { defineWalletAutoTopupJob, WALLET_AUTO_TOPUP_JOB_NAME } from "../jobs/walletAutoTopup.js";
import { defineSendEmailJob } from "../jobs/sendEmail.js";
import { defineDailyAnalyticsJob, DAILY_ANALYTICS_JOB_NAME } from "../jobs/recordDailyAnalytics.js";

/**
 * Agenda configuration — MongoDB-backed job scheduler.
 *
 * Agenda stores jobs in the `agendaJobs` collection in the same
 * MongoDB database. No Redis or external queue needed.
 *
 * Per implementation_plan.md §8
 */

let agenda: Agenda;

export function getAgenda(): Agenda {
  if (!agenda) {
    // Share Mongoose connection if active to avoid duplicate/unclosed client handles in tests/prod
    const mongoBackendOptions =
      mongoose.connection.readyState === 1 && mongoose.connection.db
        ? { mongo: mongoose.connection.db }
        : { address: env.MONGO_URL };

    agenda = new Agenda({
      backend: new MongoBackend({
        ...mongoBackendOptions,
        collection: "agendaJobs",
      }),
      processEvery: "30 seconds",
      maxConcurrency: 10,
      defaultConcurrency: 5,
    });

    // Register all job definitions
    defineWebhookJobs(agenda);
    defineTokenRefreshJob(agenda);
    defineDailyBillingScanJob(agenda);
    defineDunningRetryJob(agenda);
    defineWalletAutoTopupJob(agenda);
    defineSendEmailJob(agenda);
    defineDailyAnalyticsJob(agenda);

    // Error handling
    agenda.on("error", (err) => {
      logger.error({ err }, "Agenda error");
    });

    agenda.on("ready", () => {
      logger.info("Agenda scheduler ready");
    });

    agenda.on("start", (job) => {
      logger.debug({ jobName: job.attrs.name }, "Job started");
    });

    agenda.on("complete", (job) => {
      logger.debug({ jobName: job.attrs.name }, "Job completed");
    });

    agenda.on("fail", (err, job) => {
      logger.error(
        { jobName: job.attrs.name, err: err.message },
        "Job failed"
      );
    });
  }

  return agenda;
}

/**
 * Start Agenda and schedule recurring jobs.
 */
export async function startAgenda(): Promise<void> {
  const agendaInstance = getAgenda();

  await agendaInstance.start();

  // Schedule recurring jobs
  await agendaInstance.every("1 minute", "retry-pending-webhooks");

  // Refresh Nomba access token every 25 minutes (tokens expire in 30 min)
  // Per AGENTS.md §2.3
  await agendaInstance.every("25 minutes", TOKEN_REFRESH_JOB_NAME);

  // Daily billing scan: runs every hour to find and charge due subscriptions
  // Per overall_implementation_plan.md §6.2
  await agendaInstance.every("1 hour", DAILY_BILLING_SCAN_JOB_NAME);

  // Dunning retry scan: runs every 5 minutes to process scheduled retries
  // Per overall_implementation_plan.md §6.3
  await agendaInstance.every("5 minutes", DUNNING_RETRY_JOB_NAME);

  // Wallet auto top-up scan: runs every 5 minutes
  // Per feature_implementation_blueprint.md §1
  await agendaInstance.every("5 minutes", WALLET_AUTO_TOPUP_JOB_NAME);

  // Daily analytics snapshot generation at midnight (UTC)
  await agendaInstance.every("0 0 * * *", DAILY_ANALYTICS_JOB_NAME);

  logger.info("Agenda scheduler started with recurring jobs");
}

/**
 * Gracefully stop Agenda (called on server shutdown).
 */
export async function stopAgenda(): Promise<void> {
  if (agenda) {
    await agenda.stop();
    agenda = undefined as any;
    logger.info("Agenda scheduler stopped");
  }
}
