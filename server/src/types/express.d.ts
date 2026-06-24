import { Types } from "mongoose";

/**
 * Extend the Express Request interface to carry authentication context.
 *
 * After the `authenticate` middleware runs, every request will have:
 * - req.tenantId: the authenticated tenant's MongoDB ObjectId
 *
 * After the `portalAuthenticate` middleware runs, portal requests will have:
 * - req.customerId: the authenticated customer's MongoDB ObjectId
 * - req.tenantId: the tenant that the customer belongs to
 */
declare global {
  namespace Express {
    interface Request {
      tenantId?: Types.ObjectId;
      customerId?: Types.ObjectId;
    }
  }
}

export {};
