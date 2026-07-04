import { Router } from "express";
import {
  listTokenizedCards,
  getUserSavedCards,
  requestSaveCardAuth,
  requestSavedCardAuth,
  submitUserOtp,
  updateTokenizedCard,
  deleteTokenizedCard,
} from "../controllers/tokenizedCard.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

/**
 * Tokenized Card Routes — All require tenant authentication.
 *
 * These routes proxy to Nomba's card-on-file endpoints and cover the full
 * OTP-gated card-save and card-fetch lifecycle.
 *
 * ROUTING ORDER MATTERS:
 *   Static path segments (/user-card/saved-card/auth, /user-card/auth,
 *   /user-card, /user/:orderReference) are registered BEFORE any generic
 *   catch-all dynamic segments to prevent conflicts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * READ ENDPOINTS (no body required)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   GET /api/tokenized-cards
 *     → Lists all of the merchant's tokenized cards (paginated, filterable)
 *     → Nomba: GET /v1/checkout/tokenized-card-data
 *     → Query params: customerEmail?, startDate?, endDate?, page?
 *
 *   GET /api/tokenized-cards/user/:orderReference?otp=<otp>
 *     → Returns a specific customer's saved cards after OTP verification
 *     → Nomba: GET /v1/checkout/user-card/{orderReference}
 *     → Prerequisite: POST /api/tokenized-cards/user-card/saved-card/auth
 *       must be called first to trigger OTP delivery to the customer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OTP WRITE ENDPOINTS (JSON body required)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   POST /api/tokenized-cards/user-card/saved-card/auth
 *     → Trigger OTP to authenticate user before fetching their saved cards
 *     → Nomba: POST /v1/checkout/user-card/saved-card/auth
 *     → Call when hasSavedCards === true on the order details response
 *     → Body: { orderReference }
 *
 *   POST /api/tokenized-cards/user-card/auth
 *     → Trigger OTP to authenticate user before saving a card post-payment
 *     → Nomba: POST /v1/checkout/user-card/auth
 *     → Call after a successful payment where the user opted to save their card
 *     → Body: { orderReference, phoneNumber }
 *
 *   POST /api/tokenized-cards/user-card
 *     → Submit the OTP received by the customer to confirm card tokenization
 *     → Nomba: POST /v1/checkout/user-card
 *     → Final step of the card-save flow; completes the card tokenization
 *     → Body: { orderReference, phoneNumber, otp }
 *
 * Per Nomba API docs (Online Checkout + Charge sections)
 */

router.use(authenticate);

// ─── OTP POST ENDPOINTS ──────────────────────────────────────────────────────
//
// Registered first — all have static path segments so there is no
// ambiguity with the dynamic /:orderReference GET below.

/**
 * POST /api/tokenized-cards/user-card/saved-card/auth
 * Trigger OTP before fetching the user's saved cards.
 * Called when the order details response indicates hasSavedCards === true.
 */
router.post("/user-card/saved-card/auth", requestSavedCardAuth);

/**
 * POST /api/tokenized-cards/user-card/auth
 * Trigger OTP before saving a card after a successful payment.
 * Called immediately after payment succeeds and user opts to save their card.
 */
router.post("/user-card/auth", requestSaveCardAuth);

/**
 * POST /api/tokenized-cards/user-card
 * Submit the user's OTP to finalise and complete card tokenization.
 * This is the last step of the card-save flow.
 */
router.post("/user-card", submitUserOtp);

// ─── READ ENDPOINTS ──────────────────────────────────────────────────────────
//
// Static /user prefix must precede the root / to avoid shadowing conflicts.

/**
 * GET /api/tokenized-cards/user/:orderReference?otp=<otp>
 * Fetch saved cards for a specific customer (OTP-gated).
 * Prerequisite: POST /api/tokenized-cards/user-card/saved-card/auth
 */
router.get("/user/:orderReference", getUserSavedCards);

/**
 * GET /api/tokenized-cards
 * List all of the merchant's tokenized cards (paginated, filterable).
 */
router.get("/", listTokenizedCards);

/**
 * POST /api/tokenized-cards
 * Update the email address associated with a tokenized card.
 * Nomba validates that currentEmailAddress matches the vault record before
 * applying the update.
 * Body: { tokenKey, currentEmailAddress, newEmailAddress }
 */
router.post("/", updateTokenizedCard);

/**
 * DELETE /api/tokenized-cards
 * Permanently remove a tokenized card from Nomba's vault.
 * ⚠️  IRREVERSIBLE — tokenKey is invalidated immediately.
 * Body: { tokenKey }
 */
router.delete("/", deleteTokenizedCard);

export default router;
