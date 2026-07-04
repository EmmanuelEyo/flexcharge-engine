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
  chargeNow,
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
 * Public Checkout Route
 * POST /subscriptions/public-checkout — Initiates checkout from public hosted page
 */
router.post("/public-checkout", async (req, res, next) => {
  // To be implemented in controller
  const { publicCheckout } = await import("../controllers/subscription.controller.js");
  return publicCheckout(req, res, next);
});

router.use(authenticate);

router.post("/", validate(createSubscriptionSchema), createSubscription);
router.get("/", listSubscriptions);
router.get("/:id", getSubscription);
router.post("/:id/cancel", validate(cancelSubscriptionSchema), cancelSubscription);
router.post("/:id/change-plan", validate(changePlanSchema), changeSubscriptionPlan);
router.post("/:id/simulate-change", validate(simulateChangePlanSchema), simulateChangePlan);
router.post("/:id/pause", pauseSubscription);
router.post("/:id/resume", resumeSubscription);
router.post("/:id/charge-now", chargeNow);

export default router;
