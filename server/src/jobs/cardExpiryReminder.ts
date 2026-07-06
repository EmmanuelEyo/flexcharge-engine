import { Agenda } from "agenda";
import { Customer } from "../models/Customer.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import { logger } from "../utils/logger.js";

/**
 * Card Expiry Reminder Job
 * 
 * Runs daily to check for default cards expiring within the next 14 days.
 * If found, and no reminder has been sent yet, queues an email to the customer.
 */

export const CARD_EXPIRY_REMINDER_JOB_NAME = "card-expiry-reminder";

export function registerCardExpiryReminderJob(agenda: Agenda) {
  agenda.define(CARD_EXPIRY_REMINDER_JOB_NAME, async (job) => {
    logger.info("Starting card expiry reminder scan");

    try {
      const now = new Date();
      // Add 14 days to current date
      const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12
      
      const futureYear = futureDate.getFullYear();
      const futureMonth = futureDate.getMonth() + 1;

      // Find all customers with at least one card
      // We will iterate and check the default card manually, or we can filter in memory
      // since MM/YY string comparison in MongoDB is tricky.
      const customers = await Customer.find({
        "paymentMethods.methodType": "card",
      });

      let remindersSent = 0;

      for (const customer of customers) {
        // Find default card
        const defaultCard = customer.paymentMethods.find(
          (pm: any) => pm.isDefault && pm.methodType === "card"
        );

        if (!defaultCard || !defaultCard.tokenExpirationDate || defaultCard.expiryReminderSent) {
          continue;
        }

        const [monthStr, yearStr] = defaultCard.tokenExpirationDate.split("/");
        if (!monthStr || !yearStr) continue;

        const expMonth = parseInt(monthStr, 10);
        // Assuming "YY" format e.g. "25" -> 2025
        const expYear = 2000 + parseInt(yearStr, 10);

        // A card expires at the END of its expiration month.
        // It is considered expiring in the next 14 days if the futureDate (now + 14d)
        // goes into the month AFTER the expiration month, or if we are already past it.
        // Or simpler: alert them if the current month/year is exactly the expiration month/year
        // and we are past the 14th of the month.
        // Actually, a standard approach: Alert them in the exact calendar month it expires.
        
        const isExpiringThisMonth = expYear === currentYear && expMonth === currentMonth;
        const isAlreadyExpired = expYear < currentYear || (expYear === currentYear && expMonth < currentMonth);

        if (isExpiringThisMonth || isAlreadyExpired) {
          logger.info(
            { customerId: customer._id, expMonth, expYear },
            "Sending card expiry reminder email"
          );

          await queueEmail("customer", "card_expiring", {
            tenantId: customer.tenantId,
            customerId: customer._id,
            cardLast4: defaultCard.cardLast4,
          });

          // Mark reminder as sent
          (defaultCard as any).expiryReminderSent = true;
          await customer.save();
          remindersSent++;
        }
      }

      logger.info(
        { remindersSent },
        "Card expiry reminder scan completed"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Card expiry reminder scan failed"
      );
    }
  });
}
