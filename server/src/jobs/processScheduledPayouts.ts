import { Agenda } from "agenda";
import { Tenant } from "../models/Tenant.js";
import { TenantLedger } from "../models/TenantLedger.js";
import { ledgerService } from "../services/ledger.service.js";
import { logger } from "../utils/logger.js";

export const SCHEDULED_PAYOUTS_JOB_NAME = "process-scheduled-payouts";

export function defineScheduledPayoutsJob(agenda: Agenda) {
  agenda.define(SCHEDULED_PAYOUTS_JOB_NAME, async (job) => {
    logger.info("Running scheduled payouts job");
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
    const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; 
    const dayOfMonth = today.getUTCDate();

    try {
      // Find all tenants whose schedule matches today's date
      const eligibleTenants = await Tenant.find({
        isActive: true,
        settlementAccount: { $exists: true, $ne: null },
        $or: [
          { payoutSchedule: "daily" },
          { payoutSchedule: "weekly", payoutDayOfWeek: normalizedDayOfWeek },
          { payoutSchedule: "monthly", payoutDayOfMonth: dayOfMonth }
        ]
      });

      for (const tenant of eligibleTenants) {
        // Double check settlementAccount is fully populated
        if (!tenant.settlementAccount?.accountNumber || !tenant.settlementAccount?.bankCode) continue;

        const ledger = await TenantLedger.findOne({ tenantId: tenant._id });
        if (!ledger) continue;

        // Check if available balance meets the configured payout threshold
        const threshold = tenant.payoutThreshold || 500000;
        if (ledger.availableBalance >= threshold) {
          logger.info({ tenantId: tenant._id, balance: ledger.availableBalance }, "Processing scheduled payout");
          try {
            // Trigger standard Nomba bank transfer logic (implicitly dispatches success/failure email)
            await ledgerService.processWithdrawal(tenant._id.toString(), ledger.availableBalance);
          } catch (err: any) {
            logger.error({ tenantId: tenant._id, err: err.message }, "Scheduled payout failed");
          }
        } else {
            logger.debug({ tenantId: tenant._id, balance: ledger.availableBalance, threshold }, "Skipped payout - balance below threshold");
        }
      }
    } catch (err: any) {
        logger.error({ err: err.message }, "Error in scheduled payouts job");
    }
  });
}
