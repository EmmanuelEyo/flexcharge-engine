import axios from "axios";
import dotenv from "dotenv";
import { nombaService } from "../src/services/nomba.service.js";
import { env } from "../src/config/environment.js";

// Load dotenv
dotenv.config();

async function run() {
  console.log("=== Nomba Webhook Debugger ===");

  if (!nombaService.isConfigured()) {
    console.error("❌ Nomba credentials are not configured in your environment.");
    return;
  }

  try {
    console.log("Authenticating with Nomba...");
    const token = await nombaService.getValidToken();
    console.log("✅ Authenticated successfully.");

    const parentAccountId = env.NOMBA_ACCOUNT_ID;
    const subAccountId = env.NOMBA_SUB_ACCOUNT_ID;

    // Use yesterday and tomorrow for date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startDateTime = yesterday.toISOString().split("T")[0];
    const endDateTime = tomorrow.toISOString().split("T")[0];

    console.log(`Querying event logs for date range: ${startDateTime} to ${endDateTime}...`);

    // Let's try querying event logs with the Sub-Account ID first, as transactions flow through it.
    try {
      const response = await axios.post(
        `${env.NOMBA_BASE_URL}/v1/webhooks/event-logs`,
        {
          coreUserId: subAccountId,
          limit: 10,
          eventType: "payment_success",
          startDateTime,
          endDateTime,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accountId: parentAccountId,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("\n--- Webhook Event Logs (Sub-Account) ---");
      console.log(JSON.stringify(response.data, null, 2));

      // Check if we have logs to repush
      const logs = response.data?.data || [];
      if (logs.length > 0) {
        console.log(`\nFound ${logs.length} events. Attempting bulk repush...`);
        const hooksRequestIds = logs.map((log: any) => log.hooksRequestId || log.id).filter(Boolean);

        if (hooksRequestIds.length > 0) {
          const repushRes = await axios.post(
            `${env.NOMBA_BASE_URL}/v1/webhooks/bulk-re-push`,
            { hooksRequestIds },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                accountId: parentAccountId,
                "Content-Type": "application/json",
              },
            }
          );
          console.log("✅ Bulk repush response:", JSON.stringify(repushRes.data, null, 2));
        }
      } else {
        console.log("No failed events found to repush under sub-account.");
      }
    } catch (err: any) {
      console.error("❌ Failed to query logs using sub-account ID:", err.response?.data || err.message);
      
      console.log("\nRetrying log query using Parent Account ID...");
      const parentResponse = await axios.post(
        `${env.NOMBA_BASE_URL}/v1/webhooks/event-logs`,
        {
          coreUserId: parentAccountId,
          limit: 10,
          eventType: "payment_success",
          startDateTime,
          endDateTime,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accountId: parentAccountId,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("\n--- Webhook Event Logs (Parent Account) ---");
      console.log(JSON.stringify(parentResponse.data, null, 2));
    }

  } catch (error: any) {
    console.error("❌ Critical Error:", error.response?.data || error.message);
  }
}

run();
