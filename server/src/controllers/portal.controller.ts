import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Customer } from "../models/Customer.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { Wallet } from "../models/Wallet.js";
import { nombaService } from "../services/nomba.service.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
} from "../utils/apiResponse.js";
import { env } from "../config/environment.js";
import { queueEmail } from "../utils/emailDispatcher.js";
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

    const portalUrl = `${env.FRONTEND_URL}/portal?token=${portalToken}`;

    logger.info(
      {
        tenantId: req.tenantId,
        customerId: customer._id,
      },
      "Portal session created"
    );

    // Dispatch the email containing the magic link directly to the customer
    await queueEmail("customer", "portal_link", {
      tenantId: req.tenantId!,
      customerId: customer._id,
      portalUrl,
    } as any);

    sendCreated(res, {
      message: "Portal access link has been sent to the customer's email.",
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
    }).populate("tenantId", "name");

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /portal/subscription
 * Customer views their own subscription.
 */
export async function getPortalSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscription = await Subscription.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
      status: { $ne: "canceled" } // Or get the most recent one
    }).populate("planId", "name slug amount currency interval");

    if (!subscription) {
      throw new NotFoundError("Subscription");
    }

    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /portal/invoices
 * Customer views their invoices.
 */
export async function getPortalInvoices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const invoices = await Invoice.find({
      customerId: req.customerId,
      tenantId: req.tenantId,
    }).sort({ createdAt: -1 });

    sendSuccess(res, invoices);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/update-payment-method
 * Customer requests a Nomba checkout link to tokenize a new card.
 */
export async function requestPaymentMethodUpdate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await Customer.findOne({
      _id: req.customerId,
      tenantId: req.tenantId,
    });
    if (!customer) throw new NotFoundError("Customer");

    const subscription = await Subscription.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
      status: { $in: ["active", "past_due", "paused", "trialing"] }
    });

    if (!subscription) throw new NotFoundError("Active Subscription");

    const orderReference = `card_update_${subscription._id}_${Date.now()}`;
    const checkout = await nombaService.createCheckoutOrder({
      orderReference,
      amount: 5000, // Small auth charge (50 NGN)
      currency: "NGN",
      customerEmail: customer.email,
      callbackUrl: `${env.FRONTEND_URL || "http://localhost:3000"}/portal/dashboard?card_update=success`,
      tokenizeCard: true,
    });

    // We save this order reference so the webhook can identify it's an update
    subscription.nombaCheckoutOrderRef = orderReference;
    await subscription.save();

    sendSuccess(res, {
      checkoutLink: checkout.checkoutLink,
      orderReference: checkout.orderReference,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/cancel
 * Customer schedules cancellation.
 */
export async function cancelPortalSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscription = await Subscription.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
      status: { $in: ["active", "past_due", "paused", "trialing"] }
    });

    if (!subscription) throw new NotFoundError("Active Subscription");

    subscription.cancelAtPeriodEnd = true;
    subscription.cancellationReason = "Canceled by customer via portal";
    await subscription.save();

    await subscription.populate("planId", "name amount interval currency");

    logger.info({ subscriptionId: subscription._id }, "Subscription scheduled for cancellation via portal");

    res.status(200).json({
      success: true,
      message: "Subscription scheduled for cancellation",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /portal/wallet
 * Fetches the customer's wallet if they have one.
 */
export async function getPortalWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const wallet = await Wallet.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    sendSuccess(res, wallet);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/wallet/settings
 * Updates auto-topup configuration for the customer's wallet.
 */
export async function updateWalletSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { autoTopUp, autoTopUpAmount, autoTopUpTrigger } = req.body;

    const wallet = await Wallet.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    if (autoTopUpAmount !== undefined) {
      if (wallet.minAutoTopUpAmount && autoTopUpAmount < wallet.minAutoTopUpAmount) {
        throw new Error(`Amount is below the minimum allowed (${wallet.minAutoTopUpAmount})`);
      }
      if (wallet.maxAutoTopUpAmount && autoTopUpAmount > wallet.maxAutoTopUpAmount) {
        throw new Error(`Amount exceeds the maximum allowed (${wallet.maxAutoTopUpAmount})`);
      }
      wallet.autoTopUpAmount = Number(autoTopUpAmount);
    }

    if (autoTopUpTrigger !== undefined) {
      if (wallet.minAutoTopUpTrigger && autoTopUpTrigger < wallet.minAutoTopUpTrigger) {
        throw new Error(`Trigger is below the minimum allowed (${wallet.minAutoTopUpTrigger})`);
      }
      if (wallet.maxAutoTopUpTrigger && autoTopUpTrigger > wallet.maxAutoTopUpTrigger) {
        throw new Error(`Trigger exceeds the maximum allowed (${wallet.maxAutoTopUpTrigger})`);
      }
      wallet.autoTopUpTrigger = Number(autoTopUpTrigger);
    }

    if (autoTopUp !== undefined) {
      const isTurningOn = Boolean(autoTopUp) && !wallet.autoTopUp;
      wallet.autoTopUp = Boolean(autoTopUp);

      if (isTurningOn) {
        // Log explicit consent
        wallet.autoTopUpConsentedAt = new Date();
        wallet.autoTopUpConsentedIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
      }
    }

    await wallet.save();

    logger.info({ walletId: wallet._id, autoTopUp }, "Customer updated auto-topup settings via portal");

    sendSuccess(res, wallet);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/wallet/topup
 * Creates a checkout order for a manual top-up and returns the link.
 */
export async function initiateWalletTopUp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      throw new Error("Invalid top-up amount");
    }

    const customer = await Customer.findOne({
      _id: req.customerId,
      tenantId: req.tenantId,
    });
    if (!customer) throw new NotFoundError("Customer");

    const wallet = await Wallet.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
    });
    if (!wallet) throw new NotFoundError("Wallet");

    // We don't link manual top-ups directly to a subscription for the Nomba payload
    // to avoid confusing the webhook. We'll use a special order prefix.
    const orderReference = `manual_topup_${wallet._id}_${Date.now()}`;

    const checkout = await nombaService.createCheckoutOrder({
      orderReference,
      amount,
      currency: wallet.currency as "NGN" | "CDF" | "USD" | undefined,
      customerEmail: customer.email,
      customerId: customer._id.toString(),
      callbackUrl: `${env.FRONTEND_URL || "http://localhost:3000"}/portal/dashboard?topup=success`,
    });

    // Create a pending invoice to represent this manual top-up payment attempt
    const invoice = await Invoice.create({
      tenantId: wallet.tenantId,
      customerId: customer._id,
      amount,
      currency: wallet.currency,
      status: "pending",
      nombaOrderReference: orderReference,
      description: "Manual Wallet Top-Up",
      isRenewal: false,
    });

    logger.info({ walletId: wallet._id, orderReference, amount }, "Customer initiated manual wallet top-up");

    sendSuccess(res, {
      checkoutLink: checkout.checkoutLink,
      orderReference: checkout.orderReference,
      invoiceId: invoice._id,
    });
  } catch (error) {
    next(error);
  }
}

