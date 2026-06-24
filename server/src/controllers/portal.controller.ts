import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Customer } from "../models/Customer.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
} from "../utils/apiResponse.js";
import { env } from "../config/environment.js";
import { logger } from "../utils/logger.js";

/**
 * Portal Controller — handles customer self-service portal operations.
 *
 * POST /portal/sessions — Tenant generates a portal session for a customer
 * GET  /portal/subscription — Customer views their subscription (hackathon)
 * GET  /portal/invoices — Customer views their invoices (hackathon)
 *
 * Per implementation_plan.md §7 (Customer Portal API surface)
 */

/**
 * POST /portal/sessions
 * Generate a short-lived portal session token for a customer.
 *
 * Called by the TENANT (authenticated with API key or JWT).
 * Returns a token that the customer's browser uses to access portal routes.
 */
export async function createPortalSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      throw new NotFoundError("customerId is required");
    }

    // Verify the customer exists and belongs to this tenant
    const customer = await Customer.findOne({
      ...tenantFilter(req),
      _id: customerId,
    });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    // Generate a portal-specific JWT
    const portalToken = jwt.sign(
      {
        customerId: customer._id.toString(),
        tenantId: req.tenantId!.toString(),
        type: "portal", // Distinguishes from tenant JWTs
      },
      env.PORTAL_JWT_SECRET,
      { expiresIn: env.PORTAL_JWT_EXPIRES_IN as any }
    );

    const portalUrl = `${env.API_BASE_URL}/portal?token=${portalToken}`;

    logger.info(
      {
        tenantId: req.tenantId,
        customerId: customer._id,
      },
      "Portal session created"
    );

    sendCreated(res, {
      portalToken,
      portalUrl,
      expiresIn: env.PORTAL_JWT_EXPIRES_IN,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /portal/me
 * Customer views their own profile.
 * Protected by portalAuthenticate middleware.
 */
export async function getPortalCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await Customer.findOne({
      _id: req.customerId,
      tenantId: req.tenantId,
    });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}
