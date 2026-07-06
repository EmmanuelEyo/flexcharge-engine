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
  AppError,
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

    const orderReference = `card_up_${subscription._id}_${Date.now()}`;
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

    const cancelCtx = {
      tenantId: req.tenantId!,
      customerId: subscription.customerId as any,
      subscriptionId: subscription._id,
      cancellationReason: subscription.cancellationReason,
    };
    await queueEmail("customer", "cancel", cancelCtx);
    await queueEmail("tenant", "cancel", cancelCtx);

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
    }).populate("walletGroupId");

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
    }).populate("walletGroupId");

    if (!wallet) throw new NotFoundError("Wallet");

    // The walletGroup contains the boundaries
    const group: any = wallet.walletGroupId || {};

    if (autoTopUpAmount !== undefined) {
      if (group.minAutoTopUpAmount && autoTopUpAmount < group.minAutoTopUpAmount) {
        throw new Error(`Amount is below the minimum allowed (${group.minAutoTopUpAmount})`);
      }
      if (group.maxAutoTopUpAmount && autoTopUpAmount > group.maxAutoTopUpAmount) {
        throw new Error(`Amount exceeds the maximum allowed (${group.maxAutoTopUpAmount})`);
      }
      wallet.autoTopUpAmount = Number(autoTopUpAmount);
    }

    if (autoTopUpTrigger !== undefined) {
      if (group.minAutoTopUpTrigger && autoTopUpTrigger < group.minAutoTopUpTrigger) {
        throw new Error(`Trigger is below the minimum allowed (${group.minAutoTopUpTrigger})`);
      }
      if (group.maxAutoTopUpTrigger && autoTopUpTrigger > group.maxAutoTopUpTrigger) {
        throw new Error(`Trigger exceeds the maximum allowed (${group.maxAutoTopUpTrigger})`);
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
    const orderReference = `man_topup_${wallet._id}_${Date.now()}`;

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

/**
 * GET /portal/payment-methods
 * Returns the customer's saved payment methods (cards and mandates).
 */
export async function getPaymentMethods(
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

    sendSuccess(res, {
      paymentMethods: customer.paymentMethods || [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/payment-methods/mandate/initiate
 * Customer initiates a Direct Debit mandate setup.
 *
 * The customer provides their bank account details, and Nomba creates
 * a pending mandate. The customer must then transfer ₦50 to the
 * NIBSS validation account from the exact account provided.
 */
export async function initiateDirectDebitMandate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { bankCode, accountNumber, phoneNumber, address, accountName } = req.body;

    if (!bankCode || !accountNumber || !phoneNumber || !address || !accountName) {
      throw new Error("bankCode, accountNumber, phoneNumber, address, and accountName are required");
    }

    if (address.length < 5 || address.length > 150) {
      throw new Error("Address must be between 5 and 150 characters");
    }

    if (accountName.length < 3 || accountName.length > 100) {
      throw new Error("Account name must be between 3 and 100 characters");
    }

    if (!/^\d{3,6}$/.test(bankCode)) {
      throw new Error("Invalid bankCode format. Must be a 3 to 6-digit NIBSS code.");
    }

    const customer = await Customer.findOne({
      _id: req.customerId,
      tenantId: req.tenantId,
    });
    if (!customer) throw new NotFoundError("Customer");

    const subscription = await Subscription.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
      status: { $in: ["active", "past_due", "paused", "trialing"] },
    });
    if (!subscription) throw new NotFoundError("Active Subscription");

    // Generate a numeric-only merchant reference (Nomba requires this)
    const merchantReference = Date.now().toString() + Math.floor(Math.random() * 10000).toString();

    // Set mandate window: start in 5 minutes (prevents validation errors from minute-truncation time drift), end in 5 years
    const startDate = new Date(Date.now() + 5 * 60 * 1000);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 5);

    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const result = await nombaService.createDirectDebitMandate({
      customerAccountNumber: accountNumber,
      bankCode,
      customerName: customer.name || "Customer",
      customerAccountName: accountName,
      customerEmail: customer.email,
      customerPhoneNumber: phoneNumber,
      customerAddress: address,
      merchantReference,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    });

    // Mask the account number for display (show last 4)
    const masked = "****" + accountNumber.slice(-4);

    customer.paymentMethods.push({
      methodType: "direct_debit",
      isDefault: false,
      mandateId: result.mandateId,
      bankCode,
      accountNumberMasked: masked,
      mandateStatus: "PENDING",
    });
    await customer.save();

    logger.info(
      { customerId: customer._id, mandateId: result.mandateId },
      "Customer initiated direct debit mandate via portal"
    );

    sendCreated(res, {
      mandateId: result.mandateId,
      status: result.status,
      instructions: result.instructions,
      message:
        "Please transfer ₦50 to the validation account from the exact bank account you registered. This validates your mandate.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /portal/payment-methods/mandate/verify
 * Customer confirms they have made the ₦50 validation transfer.
 * We poll Nomba for the mandate status.
 *
 * If ACTIVE + ADVICE_SENT, we mark the mandate as active and optionally
 * switch the subscription to automatic/direct_debit billing.
 */
export async function verifyMandate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mandateId, setAsDefault } = req.body;

    if (!mandateId) {
      throw new Error("mandateId is required");
    }

    const customer = await Customer.findOne({
      _id: req.customerId,
      tenantId: req.tenantId,
    });
    if (!customer) throw new NotFoundError("Customer");

    // Check Nomba for the current mandate status
    const mandateStatus = await nombaService.checkMandateStatus(mandateId);

    // Find the matching payment method entry
    const pmIndex = customer.paymentMethods.findIndex(
      (pm) => pm.mandateId === mandateId
    );

    if (pmIndex === -1) {
      throw new Error("Mandate not found on this customer profile");
    }

    // Update the local mandate status
    customer.paymentMethods[pmIndex]!.mandateStatus =
      mandateStatus.status as "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";

    const isUsable =
      mandateStatus.status === "ACTIVE" &&
      mandateStatus.adviceStatus === "ADVICE_SENT";

    if (isUsable && setAsDefault) {
      // Clear existing defaults
      customer.paymentMethods.forEach((pm) => {
        pm.isDefault = false;
      });
      customer.paymentMethods[pmIndex]!.isDefault = true;

      // Also switch the subscription to automatic / direct_debit
      const subscription = await Subscription.findOne({
        customerId: req.customerId,
        tenantId: req.tenantId,
        status: { $in: ["active", "past_due", "paused", "trialing"] },
      });

      if (subscription) {
        subscription.renewalMode = "auto";
        subscription.automaticMethod = "direct_debit";
        await subscription.save();

        logger.info(
          { subscriptionId: subscription._id },
          "Subscription switched to automatic/direct_debit via portal"
        );
      }
    }

    await customer.save();

    logger.info(
      {
        customerId: customer._id,
        mandateId,
        status: mandateStatus.status,
        adviceStatus: mandateStatus.adviceStatus,
        isUsable,
      },
      "Customer verified mandate status via portal"
    );

    sendSuccess(res, {
      mandateId,
      status: mandateStatus.status,
      adviceStatus: mandateStatus.adviceStatus,
      isUsable,
      message: isUsable
        ? "Mandate is active and ready for billing."
        : "Mandate is not yet active. Please ensure you have transferred ₦50 from the registered account. Bank authorization may take up to 72 hours.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /portal/payment-methods/:id
 */
export async function deletePaymentMethodPortal(
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

    const pm = customer.paymentMethods.find(m => (m as any)._id?.toString() === req.params.id);
    if (!pm) throw new NotFoundError("Payment method");

    // Block deletion if default and active subscription exists
    if (pm.isDefault) {
      const activeSub = await Subscription.findOne({
        customerId: req.customerId,
        tenantId: req.tenantId,
        status: { $in: ["active", "past_due", "trialing"] },
        renewalMode: "auto",
      });
      if (activeSub) {
        throw new AppError(
          "Cannot delete default payment method of an active automatic subscription. Please configure a new default payment method first.",
          400
        );
      }
    }

    // Nomba Cleanup
    if (pm.methodType === "card" && pm.tokenKey) {
      try {
        await nombaService.deleteTokenizedCard(pm.tokenKey);
      } catch (err) {
        logger.warn({ tokenKey: pm.tokenKey, err }, "Failed to delete tokenized card from Nomba (might already be deleted)");
      }
      if (customer.tokenKey === pm.tokenKey) {
        customer.tokenKey = undefined;
        customer.cardLast4 = undefined;
        customer.cardBrand = undefined;
      }
    } else if (pm.methodType === "direct_debit" && pm.mandateId) {
      try {
        await nombaService.updateMandateStatus(pm.mandateId, "DELETE");
      } catch (err) {
        logger.warn({ mandateId: pm.mandateId, err }, "Failed to delete direct debit mandate from Nomba (might already be deleted)");
      }
    }

    customer.paymentMethods = customer.paymentMethods.filter(m => (m as any)._id?.toString() !== req.params.id) as any;
    await customer.save();

    logger.info({ customerId: req.customerId, pmId: req.params.id }, "Payment method deleted via portal");
    sendSuccess(res, { message: "Payment method deleted successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /portal/payment-methods/:id/default
 */
export async function setDefaultPaymentMethodPortal(
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

    const pm = customer.paymentMethods.find(m => (m as any)._id?.toString() === req.params.id);
    if (!pm) throw new NotFoundError("Payment method");

    if (pm.methodType === "direct_debit" && pm.mandateStatus !== "ACTIVE") {
      throw new AppError("Cannot set a pending or inactive direct debit mandate as default.", 400);
    }

    customer.paymentMethods.forEach((method: any) => {
      method.isDefault = false;
    });
    pm.isDefault = true;

    if (pm.methodType === "card") {
      customer.tokenKey = pm.tokenKey;
      customer.cardLast4 = pm.cardLast4;
      customer.cardBrand = pm.cardBrand;
    } else {
      customer.tokenKey = undefined;
      customer.cardLast4 = undefined;
      customer.cardBrand = undefined;
    }

    // Sync Subscription
    const activeSub = await Subscription.findOne({
      customerId: req.customerId,
      tenantId: req.tenantId,
      status: { $in: ["active", "past_due", "trialing"] },
      renewalMode: "auto",
    });

    if (activeSub) {
      if (pm.methodType === "card") {
        activeSub.automaticMethod = "card";
        activeSub.tokenKey = pm.tokenKey;
        activeSub.cardLast4 = pm.cardLast4;
        activeSub.cardBrand = pm.cardBrand;
      } else {
        activeSub.automaticMethod = "direct_debit";
        activeSub.tokenKey = undefined;
        activeSub.cardLast4 = undefined;
        activeSub.cardBrand = undefined;
      }
      await activeSub.save();
      logger.info({ subscriptionId: activeSub._id }, "Subscription payment method synced");
    }

    await customer.save();

    logger.info({ customerId: req.customerId, pmId: req.params.id }, "Default payment method updated via portal");
    sendSuccess(res, { message: "Default payment method updated successfully" });
  } catch (error) {
    next(error);
  }
}
