import { Router } from "express";
import {
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deletePlan,
  getPublicPlan,
} from "../controllers/plan.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createPlanSchema,
  updatePlanSchema,
} from "../validators/plan.validator.js";

const router = Router();

/**
 * Public Plan Routes
 * GET    /plans/public/:id — Get a single plan (unauthenticated) for checkout pages
 */
router.get("/public/:id", getPublicPlan);

/**
 * Plan Routes — All require authentication (API key or JWT).
 *
 * POST   /plans       — Create a new billing plan
 * GET    /plans       — List all plans (filter by ?active=true|false)
 * GET    /plans/:id   — Get a single plan
 * PATCH  /plans/:id   — Update a plan
 * DELETE /plans/:id   — Soft-delete (deactivate) a plan
 */

router.use(authenticate);

router.post("/", validate(createPlanSchema), createPlan);
router.get("/", listPlans);
router.get("/:id", getPlan);
router.patch("/:id", validate(updatePlanSchema), updatePlan);
router.delete("/:id", deletePlan);

export default router;
