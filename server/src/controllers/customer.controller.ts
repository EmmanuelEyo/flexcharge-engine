import { Request, Response, NextFunction } from "express";
import { Customer } from "../models/Customer.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
  ConflictError,
  AppError,
} from "../utils/apiResponse.js";
import { Subscription } from "../models/Subscription.js";
import { nombaService } from "../services/nomba.service.js";
import { logger } from "../utils/logger.js";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customer.validator.js";

/**
 * Customer Controller — CRUD operations for subscribers.
 *
 * All operations are scoped to the authenticated tenant.
 *
 * Per implementation_plan.md §7 (Customers API surface)
 */

/**
 * POST /customers
 * Create a new customer for the authenticated tenant.
 */
export async function createCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CreateCustomerInput;

    // Check for duplicate (same email within this tenant)
    const existing = await Customer.findOne({
      ...tenantFilter(req),
      email: input.email,
    });

    if (existing) {
      throw new ConflictError(
        "A customer with this email already exists for your account"
      );
    }

    const customer = await Customer.create({
      ...input,
      tenantId: req.tenantId,
    });

    logger.info(
      { tenantId: req.tenantId, customerId: customer._id, email: customer.email },
      "Customer created"
    );

    sendCreated(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers
 * List all customers for the authenticated tenant.
 * Supports pagination via ?page=1&limit=20 query params.
 */
export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );
    const skip = (page - 1) * limit;

    const filter = tenantFilter(req);

    // Optional search by email
    const searchFilter: Record<string, unknown> = { ...filter };
    if (req.query.email) {
      searchFilter.email = {
        $regex: req.query.email as string,
        $options: "i",
      };
    }

    const [customers, total] = await Promise.all([
      Customer.find(searchFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Customer.countDocuments(searchFilter),
    ]);

    sendSuccess(res, customers, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /customers/:id
 * Get a single customer's details.
 */
export async function getCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await Customer.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /customers/:id
 * Update a customer's details (name, phone, metadata).
 * Email cannot be changed — it is the unique identifier.
 */
export async function updateCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as UpdateCustomerInput;

    const customer = await Customer.findOneAndUpdate(
      { ...tenantFilter(req), _id: req.params.id },
      { $set: input },
      { returnDocument: "after", runValidators: true }
    );

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    logger.info(
      { tenantId: req.tenantId, customerId: customer._id },
      "Customer updated"
    );

    sendSuccess(res, customer);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /customers/:customerId/payment-methods/:id
 * Tenant removes a customer's payment method.
 */
export async function deleteCustomerPaymentMethod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
      tenantId: req.tenantId,
    });
    if (!customer) throw new NotFoundError("Customer");

    const pm = customer.paymentMethods.find(m => (m as any)._id?.toString() === req.params.id);
    if (!pm) throw new NotFoundError("Payment method");

    // Block deletion if default and active subscription exists
    if (pm.isDefault) {
      const activeSub = await Subscription.findOne({
        customerId: req.params.customerId,
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

    logger.info({ customerId: req.params.customerId, pmId: req.params.id }, "Payment method deleted via tenant API");
    sendSuccess(res, { message: "Payment method deleted successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /customers/:customerId/payment-methods/:id/default
 * Tenant sets a customer's payment method as default.
 */
export async function setCustomerDefaultPaymentMethod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customer = await Customer.findOne({
      _id: req.params.customerId,
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
      customerId: req.params.customerId,
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

    logger.info({ customerId: req.params.customerId, pmId: req.params.id }, "Default payment method updated via tenant API");
    sendSuccess(res, { message: "Default payment method updated successfully" });
  } catch (error) {
    next(error);
  }
}
