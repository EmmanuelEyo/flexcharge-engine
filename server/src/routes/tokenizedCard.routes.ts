import { Router } from "express";
import {
  listTokenizedCards,
  getUserSavedCards,
} from "../controllers/tokenizedCard.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/**
 * Tokenized Card Routes — All require tenant authentication.
 *
 * These routes proxy to Nomba's tokenized-card read endpoints and are
 * intentionally read-only (no database writes occur here).
 *
 * IMPORTANT: The specific path  /user/:orderReference  MUST be registered
 * before any catch-all dynamic segments to avoid routing conflicts.
 *
 * Routes:
 *   GET /api/tokenized-cards
 *     → Lists all of the merchant's tokenized cards (paginated, filterable)
 *     → Nomba: GET /v1/checkout/tokenized-card-data
 *
 *   GET /api/tokenized-cards/user/:orderReference?otp=<otp>
 *     → Returns a specific customer's saved cards after OTP verification
 *     → Nomba: GET /v1/checkout/user-card/{orderReference}
 *     → Prerequisite: POST /v1/checkout/user-card/saved-card/auth must be
 *       called first to trigger OTP delivery to the customer's mobile.
 *
 * Per Nomba API (Online Checkout + Charge sections)
 */

router.use(authenticate);

// Static prefix segment first — must precede any /:param routes
router.get("/user/:orderReference", getUserSavedCards);

// Root list — registered last so it doesn't shadow the /user prefix
router.get("/", listTokenizedCards);

export default router;
