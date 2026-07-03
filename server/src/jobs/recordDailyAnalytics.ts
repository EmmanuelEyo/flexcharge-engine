import { Agenda, Job } from "agenda";
import { Tenant } from "../models/Tenant.js";
import { analyticsService } from "../services/analytics.service.js";
import { logger } from "../utils/logger.js";

export const DAILY_ANALYTICS_JOB_NAME = "record-daily-analytics";

/**
 * Job that iterates over all active tenants and records their daily analytics snapshots.
 */
export async function recordDailyAnalytics(job: Job): Promise<void> {
  const date = new Date();
  
  logger.info("Starting daily analytics snapshot generation...");

  try {
    const tenants = await Tenant.find({ isActive: true });
    
    for (const tenant of tenants) {
      try {
        await analyticsService.recordSnapshotForTenant(tenant._id, date);
      } catch (error) {
        logger.error(
          { tenantId: tenant._id, error },
          "Failed to generate analytics snapshot for tenant"
        );
        // Continue processing other tenants even if one fails
      }
    }
    
    logger.info(`Completed analytics snapshots for ${tenants.length} tenants`);
  } catch (error) {
    logger.error({ error }, "Fatal error during daily analytics job");
    throw error;
  }
}

export function defineDailyAnalyticsJob(agenda: Agenda): void {
  agenda.define(DAILY_ANALYTICS_JOB_NAME, recordDailyAnalytics);
}
