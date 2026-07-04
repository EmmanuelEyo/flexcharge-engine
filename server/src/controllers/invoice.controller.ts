import { Request, Response, NextFunction } from "express";
import { Invoice } from "../models/Invoice.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import { sendSuccess, NotFoundError } from "../utils/apiResponse.js";
import { nombaService } from "../services/nomba.service.js";
import { logger } from "../utils/logger.js";

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

/**
 * GET /invoices/order/:orderReference
 * Fetch live Nomba checkout order details by the Nomba order reference.
 *
 * Flow:
 * 1. Look up the local Invoice by nombaOrderReference to verify tenant ownership
 * 2. Call Nomba GET /v1/checkout/order/{orderReference} for live order metadata
 * 3. Merge Nomba's response with the local invoice record and return a single
 *    enriched payload — giving the tenant both financial audit trail data and
 *    live Nomba business/customer context in one call.
 *
 * This is the FlexCharge wrapper for:
 * https://api.nomba.com/v1/checkout/order/{orderReference}
 *
 * Per Nomba API docs: "Use this endpoint to fetch a single checkout order,
 * using the order reference that was returned when the Order was created."
 */
export async function getOrderDetails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // req.params is typed as ParamsDictionary; with noUncheckedIndexedAccess enabled
    // the value is `string | undefined`. We assert it's always a string here
    // because Express only routes to this handler when `:orderReference` is present.
    const orderReference = req.params["orderReference"] as string;

    // === STEP 1: Tenant ownership check ===
    // Find the invoice in our DB that matches this order reference.
    // This scopes the request to the authenticated tenant and prevents
    // one tenant from fetching another tenant's order data from Nomba.
    const invoice = await Invoice.findOne({
      ...tenantFilter(req),
      nombaOrderReference: orderReference,
    })
      .populate("subscriptionId", "status planId nextBillingDate")
      .populate("customerId", "email name");

    if (!invoice) {
      throw new NotFoundError(
        `Invoice with order reference '${orderReference}'`
      );
    }

    // === STEP 2: Fetch live order from Nomba ===
    // If Nomba is not configured (e.g., local dev without credentials),
    // return only the local invoice record with a graceful degradation message.
    if (!nombaService.isConfigured()) {
      logger.warn(
        { orderReference },
        "Nomba not configured — returning local invoice data only"
      );

      sendSuccess(res, {
        invoice,
        nombaOrder: null,
        warning: "Nomba integration not configured. Showing local invoice data only.",
      });
      return;
    }

    let nombaOrderData: Awaited<ReturnType<typeof nombaService.getCheckoutOrder>> | null = null;

    try {
      nombaOrderData = await nombaService.getCheckoutOrder(orderReference);
    } catch (nombaError) {
      // Nomba API errors (e.g., order not yet propagated, network issues)
      // should not break the endpoint — return local data with error context.
      const nombaErrMsg =
        nombaError instanceof Error ? nombaError.message : "Nomba API error";

      logger.warn(
        { orderReference, error: nombaErrMsg },
        "Failed to fetch live Nomba order details — returning local invoice only"
      );

      sendSuccess(res, {
        invoice,
        nombaOrder: null,
        warning: `Could not fetch live Nomba order: ${nombaErrMsg}`,
      });
      return;
    }

    // === STEP 3: Return merged payload ===
    // Combine local invoice audit trail with Nomba's live order metadata.
    logger.info(
      {
        orderReference,
        invoiceId: invoice._id,
        invoiceStatus: invoice.status,
        nombaOrderId: nombaOrderData.order.orderId,
        hasSavedCards: nombaOrderData.hasSavedCards,
      },
      "Checkout order details fetched successfully"
    );

    sendSuccess(res, {
      // Our internal invoice record (financial audit trail)
      invoice,
      // Live Nomba order details (business metadata, customer info)
      nombaOrder: {
        orderId: nombaOrderData.order.orderId,
        orderReference: nombaOrderData.order.orderReference,
        customerId: nombaOrderData.order.customerId,
        accountId: nombaOrderData.order.accountId,
        callbackUrl: nombaOrderData.order.callbackUrl,
        customerEmail: nombaOrderData.order.customerEmail,
        // Convert Nomba's decimal NGN string → integer KOBO to stay consistent
        // with our internal representation. e.g. "10000.00" → 1000000
        amountKobo: Math.round(parseFloat(nombaOrderData.order.amount) * 100),
        amountNaira: nombaOrderData.order.amount,
        currency: nombaOrderData.order.currency,
        businessName: nombaOrderData.order.businessName,
        businessEmail: nombaOrderData.order.businessEmail,
        businessLogo: nombaOrderData.order.businessLogo,
      },
      // Card-on-file metadata for front-end checkout flows
      hasSavedCards: nombaOrderData.hasSavedCards,
      base64EncodedRsaPublicKey: nombaOrderData.base64EncodedRsaPublicKey,
    });
  } catch (error) {
    next(error);
  }
}
