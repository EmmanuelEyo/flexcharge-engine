import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
} from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import type {
  CreatePlanInput,
  UpdatePlanInput,
} from "../validators/plan.validator.js";

/**
 * Plan Controller — CRUD operations for billing plans.
 *
 * All operations are scoped to the authenticated tenant using tenantFilter().
 * A tenant can never see or modify another tenant's plans.
 *
 * Per implementation_plan.md §7 (Plans API surface)
 */

/**
 * POST /plans
 * Create a new billing plan.
 */
export async function createPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CreatePlanInput;

    const plan = await Plan.create({
      ...input,
      tenantId: req.tenantId,
    });

    logger.info(
      { tenantId: req.tenantId, planId: plan._id, name: plan.name },
      "Plan created"
    );

    sendCreated(res, plan);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /plans
 * List all plans for the authenticated tenant.
 * Supports filtering by isActive status.
 */
export async function listPlans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter: Record<string, unknown> = { ...tenantFilter(req) };

    // Optional: filter by active status
    if (req.query.active === "true") filter.isActive = true;
    if (req.query.active === "false") filter.isActive = false;

    const plans = await Plan.find(filter).sort({ createdAt: -1 }).lean();

    // Fetch subscriber counts
    const planIds = plans.map((p) => p._id);
    const subscriberCounts = await Subscription.aggregate([
      {
        $match: {
          planId: { $in: planIds },
          status: { $in: ["active", "trialing", "past_due"] },
        },
      },
      { $group: { _id: "$planId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(
      subscriberCounts.map((s) => [s._id.toString(), s.count])
    );

    const plansWithCounts = plans.map((p) => ({
      ...p,
      subscribers: countMap.get(p._id.toString()) || 0,
    }));

    sendSuccess(res, plansWithCounts);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /plans/:id
 * Get a single plan's details.
 */
export async function getPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = await Plan.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /plans/:id
 * Update a plan's properties (name, description, amount, features, isActive).
 *
 * NOTE: Changing the amount does NOT retroactively change existing subscriptions.
 * Only new subscriptions or renewals will use the updated amount.
 */
export async function updatePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as UpdatePlanInput;

    const plan = await Plan.findOneAndUpdate(
      { ...tenantFilter(req), _id: req.params.id },
      { $set: input },
      { returnDocument: "after", runValidators: true }
    );

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    logger.info(
      { tenantId: req.tenantId, planId: plan._id },
      "Plan updated"
    );

    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /plans/:id
 * Soft-delete a plan by setting isActive = false.
 * We never hard-delete plans because existing subscriptions reference them.
 */
export async function deletePlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = await Plan.findOneAndUpdate(
      { ...tenantFilter(req), _id: req.params.id },
      { isActive: false },
      { returnDocument: "after" }
    );

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    logger.info(
      { tenantId: req.tenantId, planId: plan._id },
      "Plan deactivated"
    );

    sendSuccess(res, { message: "Plan deactivated successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /plans/public/:id
 * Retrieve a single plan for public checkout pages.
 * Accepts either a MongoDB ObjectId or a plan slug (e.g. "plan_pro_001").
 * Does not require tenant auth — this is intentionally public.
 */
export async function getPublicPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const identifier = req.params.id;
    if (!identifier || typeof identifier !== "string") {
      throw new Error("Plan identifier is required and must be a string");
    }

    // Determine if the identifier is a valid MongoDB ObjectId or a slug string
    const isObjectId = Types.ObjectId.isValid(identifier) && identifier.length === 24;

    const query = isObjectId
      ? { _id: identifier, isActive: true }
      : { slug: identifier, isActive: true };

    const plan = await Plan.findOne(query)
      .populate("tenantId", "name logoUrl"); // Expose name + logoUrl for branding on checkout page

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
}
