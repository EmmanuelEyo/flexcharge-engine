import { Agenda } from "agenda";
import { Customer } from "../models/Customer.js";
import { nombaService } from "../services/nomba.service.js";
import { logger } from "../utils/logger.js";

/**
 * Mandate Sync Job — Polls Nomba for the status of PENDING direct debit mandates.
 *
 * Runs every 10 minutes.
 * Finds customers with payment methods where:
 * 1. methodType === "direct_debit"
 * 2. mandateStatus === "PENDING"
 *
 * It checks the status with Nomba and if ACTIVE, it updates the database.
 */

export const MANDATE_SYNC_JOB_NAME = "mandate-sync-scan";

export function defineMandateSyncJob(agenda: Agenda): void {
  agenda.define(MANDATE_SYNC_JOB_NAME, async (_job) => {
    try {
      // Find customers with pending mandates
      const customersWithPendingMandates = await Customer.find({
        "paymentMethods": {
          $elemMatch: {
            methodType: "direct_debit",
            mandateStatus: "PENDING",
          }
        }
      });

      if (customersWithPendingMandates.length === 0) {
        logger.debug("No pending mandates to sync");
        return;
      }

      logger.info(
        { count: customersWithPendingMandates.length },
        "Processing pending direct debit mandates"
      );

      for (const customer of customersWithPendingMandates) {
        let customerUpdated = false;
        
        for (const pm of customer.paymentMethods) {
          if (pm.methodType === "direct_debit" && pm.mandateStatus === "PENDING" && pm.mandateId) {
            try {
              const statusResponse = await nombaService.checkMandateStatus(pm.mandateId);
              
              if (statusResponse.status === "ACTIVE" && statusResponse.adviceStatus === "ADVICE_SENT") {
                pm.mandateStatus = "ACTIVE";
                customerUpdated = true;
                
                logger.info(
                  { customerId: customer._id, mandateId: pm.mandateId },
                  "Mandate successfully activated"
                );
              } else if (statusResponse.status === "SUSPENDED" || statusResponse.status === "DELETED") {
                pm.mandateStatus = statusResponse.status as any;
                customerUpdated = true;
                
                logger.warn(
                  { customerId: customer._id, mandateId: pm.mandateId, status: statusResponse.status },
                  "Mandate marked as suspended/deleted"
                );
              }
            } catch (error) {
              logger.error(
                {
                  customerId: customer._id,
                  mandateId: pm.mandateId,
                  error: error instanceof Error ? error.message : "Unknown error",
                },
                "Failed to check mandate status"
              );
            }
          }
        }
        
        if (customerUpdated) {
          await customer.save();
        }
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Mandate sync scan failed"
      );
    }
  });
}
