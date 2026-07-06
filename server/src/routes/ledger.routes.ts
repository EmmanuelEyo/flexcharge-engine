import { Router } from "express";
import { 
  getLedgerBalance, 
  setBankAccount, 
  requestWithdrawal,
  processRefund,
  getBanksList
} from "../controllers/ledger.controller.js";
import { authenticate, authenticateJWT } from "../middleware/authenticate.js";

const router = Router();

// ============================================================
// DASHBOARD ROUTES (Requires JWT)
// ============================================================

router.use("/dashboard", authenticateJWT);

/**
 * GET /api/ledger/dashboard/balance
 * Retrieve the tenant's current ledger balance and transaction history.
 */
router.get("/dashboard/balance", getLedgerBalance);

/**
 * GET /api/ledger/dashboard/banks
 * Fetch the list of banks from Nomba.
 */
router.get("/dashboard/banks", getBanksList);

/**
 * POST /api/ledger/dashboard/bank-account
 * Set the tenant's settlement bank account for withdrawals.
 */
router.post("/dashboard/bank-account", setBankAccount);

/**
 * POST /api/ledger/dashboard/withdraw
 * Request a payout to the configured settlement bank account.
 */
router.post("/dashboard/withdraw", requestWithdrawal);

// ============================================================
// DEVELOPER API ROUTES (Requires API Key)
// ============================================================

router.use("/v1", authenticate);

/**
 * GET /api/ledger/v1
 * Fetch balance and history.
 */
router.get("/v1", getLedgerBalance);

/**
 * POST /api/ledger/v1/withdrawals
 * Trigger a withdrawal programmatically.
 */
router.post("/v1/withdrawals", requestWithdrawal);

/**
 * POST /api/ledger/v1/refunds
 * Trigger a refund programmatically.
 */
router.post("/v1/refunds", processRefund);

export default router;
