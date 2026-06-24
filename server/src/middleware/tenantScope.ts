import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiResponse.js";

/**
 * Tenant Scoping Middleware.
 *
 * Ensures that `req.tenantId` has been set by the `authenticate` middleware.
 * This is a safety net — if authenticate() ran successfully, tenantId will exist.
 * But we check anyway because this is a billing system and we cannot risk
 * cross-tenant data leaks.
 *
 * Controllers use `req.tenantId` in every database query:
 *   Plan.find({ tenantId: req.tenantId })
 *
 * This middleware does NOT automatically inject tenantId into queries
 * (that would require Mongoose middleware which can be fragile).
 * Instead, we enforce it at the route level and provide a helper.
 *
 * Per implementation_plan.md §4
 */
export function requireTenantScope(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.tenantId) {
    return next(
      new AppError("Tenant scope is required. Authentication failed.", 401)
    );
  }
  next();
}

/**
 * Helper to build a tenant-scoped query filter.
 * Use in controllers:
 *
 *   const filter = tenantFilter(req);
 *   const plans = await Plan.find(filter);
 *   const plan = await Plan.findOne({ ...filter, _id: planId });
 */
export function tenantFilter(req: Request): { tenantId: typeof req.tenantId } {
  if (!req.tenantId) {
    throw new AppError("Tenant scope is required", 401);
  }
  return { tenantId: req.tenantId };
}
