import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Subscription, VALID_TRANSITIONS } from "../models/Subscription.js";
import { Plan } from "../models/Plan.js";
import { Customer } from "../models/Customer.js";
import { Invoice } from "../models/Invoice.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import { nombaService } from "../services/nomba.service.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
  AppError,
} from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/environment.js";
import type {
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  ChangePlanInput,
  SimulateChangePlanInput,
} from "../validators/subscription.validator.js";
import type { SubscriptionStatus } from "../types/subscription.types.js";
import { calculateProration } from "../utils/proration.js";
import { Wallet } from "../models/Wallet.js";
import { creditWallet, createWallet } from "../services/wallet.service.js";
import { queueWebhook } from "../services/webhook.service.js";
import { queueEmail } from "../utils/emailDispatcher.js";
import { calculateNextBillingDate } from "../services/billing.service.js";

/**
 * Subscription Controller — Manages the full subscription lifecycle.
 *
 * Per overall_implementation_plan.md §6.1 (New Subscription Checkout Flow)
 * Per AGENTS.md §3: All queries scoped to req.tenantId
 */

/**
 * POST /subscriptions
 * Create a new subscription and generate a Nomba checkout link.
 *
 * Flow (per overall_implementation_plan.md §6.1):
 * 1. Validate customer and plan exist and belong to this tenant
 * 2. Create Subscription (status: "pending")
 * 3. Create Invoice (status: "pending")
 * 4. Call Nomba: create checkout order with tokenizeCard: true
 * 5. Save orderReference + checkoutLink on Subscription
 * 6. Return { subscriptionId, checkoutLink } to the tenant
 */
export async function createSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CreateSubscriptionInput;
    const tenantId = req.tenantId!;

    // 1. Validate customer exists and belongs to this tenant
    const customer = await Customer.findOne({
      ...tenantFilter(req),
      _id: input.customerId,
    });
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    // 2. Validate plan exists, is active, and belongs to this tenant
    const plan = await Plan.findOne({
      ...tenantFilter(req),
      _id: input.planId,
      isActive: true,
    });
    if (!plan) {
      throw new NotFoundError("Plan (or plan is inactive)");
    }

    // 3. Create subscription in "pending" status
    const subscription = await Subscription.create({
      tenantId,
      customerId: customer._id,
      planId: plan._id,
      status: "pending",
      metadata: input.metadata || {},
    });

    // 4. Create a pending invoice for the initial charge
    const orderReference = `sub_${subscription._id}_${Date.now()}`;
    const idempotencyKey = `initial_${subscription._id}`;

    const invoice = await Invoice.create({
      tenantId,
      subscriptionId: subscription._id,
      customerId: customer._id,
      amount: plan.amount, // KOBO integer
      currency: plan.currency,
      status: "pending",
      nombaOrderReference: orderReference,
      description: `${plan.name} — Initial payment`,
      isRenewal: false,
      idempotencyKey,
    });

    // 5. Create Nomba checkout order (with card tokenization)
    let checkoutLink: string | undefined;
    let savedOrderRef = orderReference;

    if (nombaService.isConfigured()) {
      try {
        const checkout = await nombaService.createCheckoutOrder({
          orderReference,
          amount: plan.amount, // KOBO — service converts to NGN
          currency: plan.currency as "NGN" | "CDF" | "USD" | undefined,
          customerEmail: customer.email,
          callbackUrl: input.returnUrl || `${env.FRONTEND_URL || "http://localhost:3000"}/pay/success`,
          tokenizeCard: true,
        });

        checkoutLink = checkout.checkoutLink;
        // BUG FIX: Do NOT overwrite `savedOrderRef` with `checkout.orderReference`!
        // Nomba's API returns a generated UUID in the response, but sends back our original `orderReference` in the webhook.
        // We must save our original reference so the webhook can find the subscription.
        // savedOrderRef = checkout.orderReference; 

        // Update subscription with checkout details
        subscription.nombaCheckoutOrderRef = savedOrderRef;
        subscription.checkoutLink = checkoutLink;
        await subscription.save();

        // Update invoice with the final order reference from Nomba
        invoice.nombaOrderReference = savedOrderRef;
        await invoice.save();
      } catch (error) {
        logger.error(
          {
            subscriptionId: subscription._id,
            error: error instanceof Error ? error.message : "Unknown",
          },
          "Failed to create Nomba checkout order"
        );
        // Don't fail the subscription creation — the tenant can retry
        // The subscription remains in "pending" state
      }
    } else {
      logger.warn(
        { subscriptionId: subscription._id },
        "Nomba not configured — subscription created without checkout link"
      );
    }

    logger.info(
      {
        tenantId,
        subscriptionId: subscription._id,
        planId: plan._id,
        customerId: customer._id,
      },
      "Subscription created"
    );

    sendCreated(res, {
      subscription: subscription.toJSON(),
      checkoutLink: checkoutLink || null,
      invoiceId: invoice._id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /subscriptions
 * List all subscriptions for the authenticated tenant.
 * Supports filtering by status and customerId.
 */
export async function listSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter: Record<string, unknown> = { ...tenantFilter(req) };

    if (req.query.status) {
      filter.status = req.query.status;
    } else {
      filter.status = { $ne: "pending" };
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    const subscriptions = await Subscription.find(filter)
      .populate("planId", "name slug amount currency interval")
      .populate("customerId", "email name")
      .sort({ createdAt: -1 });

    sendSuccess(res, subscriptions);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /subscriptions/:id
 * Get a single subscription's details.
 */
export async function getSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscription = await Subscription.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    })
      .populate("planId", "name slug amount currency interval")
      .populate("customerId", "email name");

    if (!subscription) {
      throw new NotFoundError("Subscription");
    }

    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /subscriptions/:id/cancel
 * Cancel a subscription (immediately or at period end).
 *
 * Per overall_implementation_plan.md §6.5
 */
export async function cancelSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CancelSubscriptionInput;

    const subscription = await Subscription.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!subscription) {
      throw new NotFoundError("Subscription");
    }

    if (subscription.status === "canceled") {
      throw new AppError("Subscription is already canceled", 400);
    }

    if (input.cancelAtPeriodEnd) {
      // Graceful cancellation: stays active until period end
      subscription.cancelAtPeriodEnd = true;
      subscription.cancellationReason = input.cancellationReason;
      await subscription.save();

      logger.info(
        { subscriptionId: subscription._id },
        "Subscription set to cancel at period end"
      );
    } else {
      // Immediate cancellation
      const previousStatus = subscription.status;
      (subscription as any)._previousStatus = previousStatus;
      subscription.status = "canceled";
      subscription.canceledAt = new Date();
      subscription.cancellationReason = input.cancellationReason;
      await subscription.save();

      logger.info(
        { subscriptionId: subscription._id, from: previousStatus },
        "Subscription canceled immediately"
      );
    }

    sendSuccess(res, subscription);

    // Queue cancel emails to customer and tenant (fire-and-forget after response)
    const cancelCtx = {
      tenantId: req.tenantId!,
      customerId: subscription.customerId as any,
      subscriptionId: subscription._id,
      cancellationReason: input.cancellationReason,
    };
    queueEmail("customer", "cancel", cancelCtx);
    queueEmail("tenant", "cancel", cancelCtx);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /subscriptions/public-checkout
 * Create a subscription from the hosted public checkout page.
 * Creates the customer on the fly if they don't exist.
 */
export async function publicCheckout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { planId, email, name, returnUrl } = req.body;

    if (!planId || !email || !name) {
      throw new AppError("planId, email, and name are required", 400);
    }

    // Accept either a MongoDB ObjectId or a slug (e.g. "plan_pro_001")
    const { Types } = await import("mongoose");
    const isObjectId = Types.ObjectId.isValid(planId) && planId.length === 24;
    const planQuery = isObjectId
      ? { _id: planId, isActive: true }
      : { slug: planId, isActive: true };

    // Find the plan to get the tenantId
    const plan = await Plan.findOne(planQuery);
    if (!plan) {
      throw new NotFoundError("Plan");
    }

    const tenantId = plan.tenantId;

    // Find or create customer
    let customer = await Customer.findOne({ tenantId, email });
    if (!customer) {
      customer = await Customer.create({
        tenantId,
        email,
        name: name,
      });
    }

    // Create subscription in "pending" status
    const subscription = await Subscription.create({
      tenantId,
      customerId: customer._id,
      planId: plan._id,
      status: "pending",
      metadata: { source: "hosted_checkout" },
    });

    const orderReference = `sub_${subscription._id}_${Date.now()}`;
    const idempotencyKey = `initial_${subscription._id}`;

    const invoice = await Invoice.create({
      tenantId,
      subscriptionId: subscription._id,
      customerId: customer._id,
      amount: plan.amount,
      currency: plan.currency,
      status: "pending",
      nombaOrderReference: orderReference,
      description: `${plan.name} — Initial payment`,
      isRenewal: false,
      idempotencyKey,
    });

    let checkoutLink: string | undefined;
    let savedOrderRef = orderReference;

    if (nombaService.isConfigured()) {
      try {
        const checkout = await nombaService.createCheckoutOrder({
          orderReference,
          amount: plan.amount,
          currency: plan.currency as "NGN" | "CDF" | "USD" | undefined,
          customerEmail: customer.email,
          callbackUrl: returnUrl || `${env.FRONTEND_URL || "http://localhost:3000"}/pay/success`,
          tokenizeCard: true,
        });

        checkoutLink = checkout.checkoutLink;
        // BUG FIX: Do NOT overwrite `savedOrderRef` with `checkout.orderReference`!
        // Nomba's API returns a generated UUID in the response, but sends back our original `orderReference` in the webhook.
        // We must save our original reference so the webhook can find the subscription.
        // savedOrderRef = checkout.orderReference;

        subscription.nombaCheckoutOrderRef = savedOrderRef;
        subscription.checkoutLink = checkoutLink;
        await subscription.save();

        invoice.nombaOrderReference = savedOrderRef;
        await invoice.save();
      } catch (error) {
        logger.error(
          {
            subscriptionId: subscription._id,
            error: error instanceof Error ? error.message : "Unknown",
          },
          "Failed to create Nomba checkout order (public)"
        );
      }
    }

    sendCreated(res, { subscriptionId: subscription._id, checkoutLink });
  } catch (error) {
    next(error);
  }
}


/**
 * POST /subscriptions/:id/simulate-change
 * Preview a plan change (dry-run).
 */
export async function simulateChangePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as SimulateChangePlanInput;
    const { id } = req.params;
    const tenantId = req.tenantId;

    const subscription = await Subscription.findOne({ _id: id, ...tenantFilter(req) });
    if (!subscription) throw new NotFoundError("Subscription");
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new AppError("Can only simulate changes for active subscriptions", 400);
    }

    const [currentPlan, newPlan] = await Promise.all([
      Plan.findOne({ _id: subscription.planId, ...tenantFilter(req) }),
      Plan.findOne({ _id: input.newPlanId, ...tenantFilter(req), isActive: true }),
    ]);

    if (!currentPlan) throw new NotFoundError("Current plan");
    if (!newPlan) throw new NotFoundError("New plan");

    const changeDate = input.changeDate ? new Date(input.changeDate) : new Date();
    const result = calculateProration({
      currentPlanAmount: currentPlan.amount,
      newPlanAmount: newPlan.amount,
      currentPeriodStart: subscription.currentPeriodStart!,
      currentPeriodEnd: subscription.currentPeriodEnd!,
      changeDate,
    });

    const formatKobo = (kobo: number) => {
      const naira = kobo / 100;
      const sign = naira < 0 ? "-" : "";
      return `${sign}₦${Math.abs(naira).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    };

    sendSuccess(res, {
      simulation: true,
      warning: "This is a preview. No charges have been made.",
      subscription: {
        id: subscription._id,
        currentPlanId: currentPlan._id,
        currentPlanName: currentPlan.name,
        newPlanId: newPlan._id,
        newPlanName: newPlan.name,
      },
      proration: {
        type: result.isUpgrade ? "upgrade" : "downgrade",
        changeDate: changeDate.toISOString(),
        currentPeriod: {
          start: subscription.currentPeriodStart!.toISOString(),
          end: subscription.currentPeriodEnd!.toISOString(),
        },
        totalDaysInPeriod: result.totalDaysInPeriod,
        daysRemaining: result.daysRemaining,
        unusedCredit: result.unusedCredit,
        newPlanCostRemaining: result.newPlanCostForRemaining,
      },
      invoice: {
        subtotal: Math.max(0, result.amountDue),
        subtotalFormatted: formatKobo(Math.max(0, result.amountDue)),
        amountDue: Math.max(0, result.amountDue),
        amountDueFormatted: formatKobo(Math.max(0, result.amountDue)),
        credit: result.unusedCredit,
        creditFormatted: formatKobo(result.unusedCredit),
        currency: currentPlan.currency,
      },
      nextBillingDate: subscription.currentPeriodEnd!.toISOString(),
      nextBillingAmount: newPlan.amount,
      nextBillingAmountFormatted: formatKobo(newPlan.amount),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /subscriptions/:id/change-plan
 * Execute a plan upgrade or downgrade.
 */
export async function changeSubscriptionPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as ChangePlanInput;
    const { id } = req.params;
    
    // Acquire optimistic lock / lookup
    const subscription = await Subscription.findOne({ _id: id, ...tenantFilter(req) });
    if (!subscription) throw new NotFoundError("Subscription");
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new AppError("Can only change active subscriptions", 400);
    }

    const [currentPlan, newPlan] = await Promise.all([
      Plan.findOne({ _id: subscription.planId, ...tenantFilter(req) }),
      Plan.findOne({ _id: input.newPlanId, ...tenantFilter(req), isActive: true }),
    ]);

    if (!currentPlan) throw new NotFoundError("Current plan");
    if (!newPlan) throw new NotFoundError("New plan");

    const changeDate = new Date();
    const result = calculateProration({
      currentPlanAmount: currentPlan.amount,
      newPlanAmount: newPlan.amount,
      currentPeriodStart: subscription.currentPeriodStart!,
      currentPeriodEnd: subscription.currentPeriodEnd!,
      changeDate,
    });

    let paymentStatus = "paid";
    let nombaOrderRef;

    if (result.isUpgrade && result.amountDue > 0) {
      if (!subscription.tokenKey || !nombaService.isConfigured()) {
        throw new AppError("Cannot process upgrade without a valid payment token", 400);
      }
      const customer = await Customer.findById(subscription.customerId);
      const orderRef = `charge_${Date.now()}`;
      const chargeResult = await nombaService.chargeTokenizedCard({
        orderReference: orderRef,
        tokenKey: subscription.tokenKey,
        amount: result.amountDue,
        currency: newPlan.currency as "NGN" | "CDF" | "USD" | undefined,
        customerEmail: customer!.email,
      });

      if (!chargeResult.success) {
        throw new AppError(`Upgrade payment failed: ${chargeResult.message}`, 402);
      }
      nombaOrderRef = orderRef;
    }

    // Process invoice if there's an amount due
    let invoice;
    if (result.amountDue > 0) {
      invoice = await Invoice.create({
        tenantId: subscription.tenantId,
        customerId: subscription.customerId,
        subscriptionId: subscription._id,
        amount: result.amountDue,
        currency: newPlan.currency,
        status: paymentStatus as any,
        nombaOrderReference: nombaOrderRef,
        isRenewal: false,
        description: `Plan upgrade from ${subscription.planId} to ${newPlan._id}`,
      });
    }

    if (!result.isUpgrade && result.unusedCredit > 0) {
      // Downgrade credit to wallet
      let wallet = await Wallet.findOne({ customerId: subscription.customerId, tenantId: subscription.tenantId });
      if (!wallet) {
        wallet = await createWallet(subscription.tenantId as any, subscription.customerId as any);
      }
      await creditWallet(
        wallet._id as any,
        result.unusedCredit,
        `Downgrade credit from ${currentPlan.name} to ${newPlan.name}`
      );
    }

    subscription.planId = newPlan._id;
    await subscription.save();

    await queueWebhook(subscription.tenantId, "subscription.updated", {
      subscriptionId: subscription._id,
      oldPlanId: currentPlan._id,
      newPlanId: newPlan._id,
      proration: result,
    });

    logger.info({ subscriptionId: subscription._id, from: currentPlan._id, to: newPlan._id }, "Subscription plan changed");
    sendSuccess(res, { subscription, invoice });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /subscriptions/:id/pause
 * Pause an active subscription.
 */
export async function pauseSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscription = await Subscription.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!subscription) throw new NotFoundError("Subscription");

    (subscription as any)._previousStatus = subscription.status;
    subscription.status = "paused";
    await subscription.save();

    await queueWebhook(subscription.tenantId, "subscription.paused", { subscriptionId: subscription._id });

    logger.info({ subscriptionId: subscription._id }, "Subscription paused");
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /subscriptions/:id/resume
 * Resume a paused subscription.
 */
export async function resumeSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscription = await Subscription.findOne({ _id: req.params.id, ...tenantFilter(req) });
    if (!subscription) throw new NotFoundError("Subscription");

    (subscription as any)._previousStatus = subscription.status;
    subscription.status = "active";
    await subscription.save();

    await queueWebhook(subscription.tenantId, "subscription.resumed", { subscriptionId: subscription._id });

    logger.info({ subscriptionId: subscription._id }, "Subscription resumed");
    sendSuccess(res, subscription);
  } catch (error) {
    next(error);
  }
}
/**
 * POST /subscriptions/:id/charge-now
 * Immediately trigger a tokenized card charge for a subscription.
 *
 * This endpoint wraps Nomba's POST /v1/checkout/tokenized-card-payment
 * and is the FlexCharge-native way for tenants to:
 *  1. Manually retry a failed charge for a past_due subscription
 *  2. Trigger an early renewal without waiting for the billing cron
 *  3. Build their own "Pay now" button in their frontend
 *
 * Requirements:
 *  - Subscription must be active or past_due
 *  - Subscription must have a tokenKey stored (card must be on file)
 *
 * Flow:
 * 1. Validate subscription ownership and tokenKey presence
 * 2. Create a pending Invoice for audit trail (idempotency-keyed)
 * 3. Call Nomba chargeTokenizedCard via nombaService
 * 4. On success: mark invoice paid, reset dunning, advance billing dates
 * 5. On failure: mark invoice failed, increment dunning
 * 6. Fire appropriate webhooks and return result
 *
 * Per Nomba API: POST /v1/checkout/tokenized-card-payment
 */
export async function chargeNow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const subscriptionId = req.params["id"] as string;
    const tenantId = req.tenantId!;

    // === STEP 1: Load and validate subscription ===
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      ...tenantFilter(req),
    })
      .populate("planId")
      .populate("customerId");

    if (!subscription) {
      throw new NotFoundError("Subscription");
    }

    const plan = subscription.planId as any;
    const customer = subscription.customerId as any;

    if (!plan || !customer) {
      throw new AppError("Subscription plan or customer data is missing", 422);
    }

    // Only allow charging active or past_due subscriptions
    if (!["active", "past_due"].includes(subscription.status)) {
      throw new AppError(
        `Cannot charge a subscription with status '${subscription.status}'. Only 'active' or 'past_due' subscriptions can be charged.`,
        422
      );
    }

    // Must have a tokenized card on file
    if (!subscription.tokenKey) {
      throw new AppError(
        "No tokenized card on file for this subscription. The customer must complete a checkout with tokenizeCard enabled first.",
        422
      );
    }

    // === STEP 2: Create a pending invoice (idempotency-keyed) ===
    const now = new Date();
    const periodEndStr = subscription.currentPeriodEnd
      ? subscription.currentPeriodEnd.toISOString().split("T")[0]
      : now.toISOString().split("T")[0];
    const idempotencyKey = `chargenow_${subscription._id}_${periodEndStr}`;

    // Check for existing charge this period to prevent duplicate charges
    const existingInvoice = await Invoice.findOne({ idempotencyKey });
    if (existingInvoice && existingInvoice.status === "paid") {
      sendSuccess(res, {
        charged: false,
        message: "Subscription is already paid for this billing period.",
        invoice: existingInvoice,
      });
      return;
    }

    const orderReference = `chargenow_${subscription._id}_${Date.now()}`;
    const invoice = await Invoice.create({
      tenantId,
      subscriptionId: subscription._id,
      customerId: customer._id,
      amount: plan.amount,
      currency: plan.currency || "NGN",
      status: "pending",
      nombaOrderReference: orderReference,
      description: `${plan.name} — Manual Charge`,
      isRenewal: true,
      idempotencyKey,
    });

    // === STEP 3: Charge the tokenized card via Nomba ===
    let chargeResult: { success: boolean; message: string };

    try {
      chargeResult = await nombaService.chargeTokenizedCard({
        tokenKey: subscription.tokenKey,
        orderReference,
        amount: plan.amount,
        currency: plan.currency || "NGN",
        customerEmail: customer.email,
        customerId: customer._id.toString(),
        callbackUrl: `${env.FRONTEND_URL}/billing/complete?ref=${orderReference}`,
        orderMetaData: {
          trigger: "manual_charge_now",
          subscriptionId: subscription._id.toString(),
          tenantId: tenantId.toString(),
        },
      });
    } catch (nombaError) {
      const errMsg =
        nombaError instanceof Error ? nombaError.message : "Nomba API error";

      invoice.status = "failed";
      invoice.failureReason = errMsg;
      await invoice.save();

      logger.error(
        { subscriptionId: subscription._id, invoiceId: invoice._id, error: errMsg },
        "chargeNow: Nomba API call failed"
      );

      throw new AppError(`Payment gateway error: ${errMsg}`, 502);
    }

    // === STEP 4: Handle result ===
    if (chargeResult.success) {
      // --- SUCCESS ---
      invoice.status = "paid";
      invoice.paidAt = new Date();
      invoice.nombaTransactionId = orderReference;
      await invoice.save();

      // Advance billing dates
      const newPeriodStart = subscription.currentPeriodEnd || now;
      const newPeriodEnd = calculateNextBillingDate(newPeriodStart, plan.interval);

      (subscription as any)._previousStatus = subscription.status;
      subscription.status = "active";
      subscription.currentPeriodStart = newPeriodStart;
      subscription.currentPeriodEnd = newPeriodEnd;
      subscription.nextBillingDate = newPeriodEnd;
      subscription.dunningAttemptCount = 0;
      subscription.lastDunningAt = undefined;
      await subscription.save();

      await queueWebhook(tenantId, "subscription.renewed", {
        subscriptionId: subscription._id,
        customerId: customer._id,
        planId: plan._id,
        amount: plan.amount,
        currency: plan.currency,
        currentPeriodStart: newPeriodStart.toISOString(),
        currentPeriodEnd: newPeriodEnd.toISOString(),
        invoiceId: invoice._id,
        trigger: "manual_charge_now",
      });

      await queueEmail("customer", "receipt", {
        tenantId,
        customerId: customer._id,
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
      });

      logger.info(
        {
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          nextBilling: newPeriodEnd.toISOString(),
        },
        "chargeNow: Subscription charged and renewed successfully"
      );

      sendSuccess(res, {
        charged: true,
        message: chargeResult.message || "Charge successful",
        invoice,
        nextBillingDate: newPeriodEnd.toISOString(),
      });
    } else {
      // --- FAILURE ---
      invoice.status = "failed";
      invoice.failureReason = chargeResult.message || "Card charge declined";
      await invoice.save();

      subscription.dunningAttemptCount = (subscription.dunningAttemptCount || 0) + 1;
      subscription.lastDunningAt = new Date();
      if (subscription.status === "active") {
        (subscription as any)._previousStatus = subscription.status;
        subscription.status = "past_due";
      }
      await subscription.save();

      await queueWebhook(tenantId, "subscription.payment_failed", {
        subscriptionId: subscription._id,
        invoiceId: invoice._id,
        amount: plan.amount,
        currency: plan.currency,
        failureReason: chargeResult.message,
        trigger: "manual_charge_now",
      });

      logger.warn(
        {
          subscriptionId: subscription._id,
          invoiceId: invoice._id,
          message: chargeResult.message,
        },
        "chargeNow: Tokenized card charge declined"
      );

      sendSuccess(res, {
        charged: false,
        message: chargeResult.message || "Card charge declined",
        invoice,
      });
    }
  } catch (error) {
    next(error);
  }
}
