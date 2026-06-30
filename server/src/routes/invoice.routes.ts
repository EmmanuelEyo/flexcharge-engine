import { Router } from "express";
import { listInvoices, getInvoice } from "../controllers/invoice.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/**
 * Invoice Routes — All require authentication (API key or JWT).
 *
 * GET  /invoices      — List all invoices (?status=paid&subscriptionId=...&customerId=...)
 * GET  /invoices/:id  — Get invoice details
 *
 * Invoices are created automatically by the billing engine.
 * Per overall_implementation_plan.md §7
 */

router.use(authenticate);

router.get("/", listInvoices);
router.get("/:id", getInvoice);

export default router;
