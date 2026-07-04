import { Router } from "express";
import {
  listInvoices,
  getInvoice,
  getOrderDetails,
} from "../controllers/invoice.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/**
 * Invoice Routes — All require authentication (API key or JWT).
 *
 * GET  /invoices                          — List all invoices (?status=paid&subscriptionId=...&customerId=...)
 * GET  /invoices/order/:orderReference    — Fetch live Nomba checkout order details by orderReference
 * GET  /invoices/:id                      — Get invoice details by MongoDB _id
 *
 * IMPORTANT: /order/:orderReference must be registered BEFORE /:id
 * to prevent Express from treating the literal string "order" as an ObjectId.
 *
 * Invoices are created automatically by the billing engine.
 * Per overall_implementation_plan.md §7
 */

router.use(authenticate);

router.get("/", listInvoices);
router.get("/order/:orderReference", getOrderDetails);
router.get("/:id", getInvoice);

export default router;
