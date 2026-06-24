import { Agenda } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { env } from "./environment.js";
import { logger } from "../utils/logger.js";
import { defineWebhookJobs } from "../jobs/webhookDelivery.js";

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
    agenda = new Agenda({
      backend: new MongoBackend({
        address: env.MONGO_URL,
        collection: "agendaJobs",
      }),
      processEvery: "30 seconds",
      maxConcurrency: 10,
      defaultConcurrency: 5,
    });

    // Register all job definitions
    defineWebhookJobs(agenda);

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

  logger.info("Agenda scheduler started with recurring jobs");
}

/**
 * Gracefully stop Agenda (called on server shutdown).
 */
export async function stopAgenda(): Promise<void> {
  if (agenda) {
    await agenda.stop();
    logger.info("Agenda scheduler stopped");
  }
}
