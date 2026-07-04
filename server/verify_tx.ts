import { nombaService } from "./src/services/nomba.service.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const transactionId = "WEB-ONLINE_C-5102A-26ca5cce-1ca5-4cd3-9f09-ca9aa70281b9";
  const subAccountId = "5102a72b-3dac-42d0-a549-3094ad0c36ea";

  console.log("=== VERIFYING LIVE TRANSACTION ON NOMBA ===");
  try {
    const tx = await nombaService.verifyTransaction(transactionId);
    console.log("Transaction status on Nomba:", JSON.stringify(tx, null, 2));
  } catch (err: any) {
    console.error("Failed to verify transaction:", err.response?.data || err.message);
  }

  console.log("\n=== CHECKING LIVE PARENT BALANCE ===");
  try {
    const token = await nombaService.getValidToken();
    const response = await (nombaService as any).client.get("/v1/accounts/balance", {
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: process.env.NOMBA_ACCOUNT_ID
      }
    });
    console.log("Parent Balance:", JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    console.error("Failed to get parent balance:", err.response?.data || err.message);
  }
}

run().catch(console.error);
