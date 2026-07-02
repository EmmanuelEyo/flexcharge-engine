import { Request, Response, NextFunction } from "express";
import { Plan } from "../models/Plan.js";
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

    const plans = await Plan.find(filter).sort({ createdAt: -1 });

    sendSuccess(res, plans);
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
      { new: true, runValidators: true }
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
      { new: true }
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
 * Does not require tenantId scoping as it's public.
 */
export async function getPublicPlan(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, isActive: true })
      .populate("tenantId", "name"); // Only expose name as Tenant schema stores name, not businessName

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
}
