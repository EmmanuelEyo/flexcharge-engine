import { Router } from "express";
import {
  listInvoices,
  getInvoice,
  getOrderDetails,
  fetchCheckoutTransaction,
} from "../controllers/invoice.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/**
 * Invoice Routes — All require authentication (API key or JWT).
 *
 * GET  /invoices                               — List all invoices
 * GET  /invoices/checkout-transaction          — Fetch live Nomba checkout transaction
 *                                               (?idType=ORDER_REFERENCE&id=... or ?idType=ORDER_ID&id=...)
 * GET  /invoices/order/:orderReference         — Fetch live Nomba checkout order details
 * GET  /invoices/:id                           — Get invoice details by MongoDB _id
 *
 * IMPORTANT: static path segments (/checkout-transaction, /order/:ref) MUST be
 * registered BEFORE /:id to prevent Express from matching literal strings as ObjectIds.
 *
 * Invoices are created automatically by the billing engine.
 * Per overall_implementation_plan.md §7
 */

router.use(authenticate);

router.get("/", listInvoices);
router.get("/checkout-transaction", fetchCheckoutTransaction);
router.get("/order/:orderReference", getOrderDetails);
router.get("/:id", getInvoice);

export default router;
