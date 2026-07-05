import { Router } from "express";
import {
  createNewWallet,
  getWallet,
  listWallets,
  topUp,
  deduct,
  listTransactions,
  assignWalletGroup,
} from "../controllers/wallet.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createWalletSchema,
  topUpWalletSchema,
  debitWalletSchema,
  updateAutoTopUpSchema,
} from "../validators/wallet.validator.js";

const router = Router();

/**
 * Wallet Routes — All require authentication (API key or JWT).
 *
 * POST   /wallets                      — Create a new wallet
 * GET    /wallets                      — List all wallets (?customerId=...)
 * GET    /wallets/:id                  — Get wallet details
 * POST   /wallets/:id/top-up           — Add funds to a wallet
 * POST   /wallets/:id/deduct           — Deduct funds from a wallet
 * GET    /wallets/:id/transactions     — List transaction ledger
 * PATCH  /wallets/:id/auto-top-up      — Update auto-top-up settings
 *
 * Per feature_implementation_blueprint.md §1
 */

router.use(authenticate);

router.post("/", validate(createWalletSchema), createNewWallet);
router.get("/", listWallets);
router.get("/:id", getWallet);
router.post("/:id/top-up", validate(topUpWalletSchema), topUp);
router.post("/:id/deduct", validate(debitWalletSchema), deduct);
router.get("/:id/transactions", listTransactions);
router.patch("/:id/wallet-group", assignWalletGroup);

export default router;
