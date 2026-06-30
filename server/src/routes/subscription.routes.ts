import { Router } from "express";
import {
  createSubscription,
  listSubscriptions,
  getSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  simulateChangePlan,
  pauseSubscription,
  resumeSubscription,
} from "../controllers/subscription.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
  changePlanSchema,
  simulateChangePlanSchema,
} from "../validators/subscription.validator.js";

const router = Router();

/**
 * Subscription Routes — All require authentication (API key or JWT).
 *
 * POST   /subscriptions                       — Create a new subscription (returns checkout link)
 * GET    /subscriptions                       — List all subscriptions (?status=active&customerId=...)
 * GET    /subscriptions/:id                   — Get subscription details
 * POST   /subscriptions/:id/cancel            — Cancel a subscription
 * POST   /subscriptions/:id/change-plan       — Execute a plan upgrade or downgrade (proration)
 * POST   /subscriptions/:id/simulate-change   — Dry-run calculation for plan changes
 * POST   /subscriptions/:id/pause             — Pause an active subscription
 * POST   /subscriptions/:id/resume            — Resume a paused subscription
 *
 * Per overall_implementation_plan.md §7 (Subscriptions API surface)
 */

router.use(authenticate);

router.post("/", validate(createSubscriptionSchema), createSubscription);
router.get("/", listSubscriptions);
router.get("/:id", getSubscription);
router.post("/:id/cancel", validate(cancelSubscriptionSchema), cancelSubscription);
router.post("/:id/change-plan", validate(changePlanSchema), changeSubscriptionPlan);
router.post("/:id/simulate-change", validate(simulateChangePlanSchema), simulateChangePlan);
router.post("/:id/pause", pauseSubscription);
router.post("/:id/resume", resumeSubscription);

export default router;
