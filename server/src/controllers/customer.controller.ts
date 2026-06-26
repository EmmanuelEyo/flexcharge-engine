import { Request, Response, NextFunction } from "express";
import { Customer } from "../models/Customer.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
  ConflictError,
} from "../utils/apiResponse.js";
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
      { new: true, runValidators: true }
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
