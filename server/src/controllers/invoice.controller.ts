import { Request, Response, NextFunction } from "express";
import { Invoice } from "../models/Invoice.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import { sendSuccess, NotFoundError } from "../utils/apiResponse.js";

/**
 * Invoice Controller — Read-only endpoints for invoice history.
 *
 * Invoices are created automatically by the subscription and billing
 * services. Tenants can only list and view invoices, not create them.
 *
 * Per overall_implementation_plan.md §7 (Invoices API surface)
 * Per AGENTS.md §3: All queries scoped to req.tenantId
 */

/**
 * GET /invoices
 * List all invoices for the authenticated tenant.
 * Supports filtering by status, subscriptionId, and customerId.
 */
export async function listInvoices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter: Record<string, unknown> = { ...tenantFilter(req) };

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.subscriptionId) {
      filter.subscriptionId = req.query.subscriptionId;
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    const invoices = await Invoice.find(filter)
      .populate("subscriptionId", "status planId")
      .populate("customerId", "email name")
      .sort({ createdAt: -1 });

    sendSuccess(res, invoices);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /invoices/:id
 * Get a single invoice's details.
 */
export async function getInvoice(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const invoice = await Invoice.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    })
      .populate("subscriptionId", "status planId")
      .populate("customerId", "email name");

    if (!invoice) {
      throw new NotFoundError("Invoice");
    }

    sendSuccess(res, invoice);
  } catch (error) {
    next(error);
  }
}
