import { z } from "zod";

/**
 * Zod validation schemas for Tokenized Card OTP endpoints.
 *
 * Three POST endpoints follow the same card-on-file OTP flow:
 *
 *   1. requestSaveCardAuthSchema
 *      POST /api/tokenized-cards/user-card/auth
 *      → Trigger OTP before saving a card after a successful payment.
 *
 *   2. requestSavedCardAuthSchema
 *      POST /api/tokenized-cards/user-card/saved-card/auth
 *      → Trigger OTP before fetching a user's already-saved cards.
 *
 *   3. submitUserOtpSchema
 *      POST /api/tokenized-cards/user-card
 *      → Submit the OTP to confirm and complete the card save.
 *
 * Per Nomba API docs (Charge section — OTP family of endpoints).
 *
 * NOTE: This project uses Zod v4. Breaking changes from v3:
 *   - `{ required_error: "..." }` is no longer supported; pass the error
 *     message as a plain string to z.string("message") instead.
 *   - ZodError uses `.issues` not `.errors`.
 */

// ---------------------------------------------------------------------------
// Nigerian phone number helper
// Matches: 070xxxxxxxx | 080xxxxxxxx | 081xxxxxxxx | 090xxxxxxxx | 091xxxxxxxx
// Also accepts the +234 or bare 234 prefix variations.
// ---------------------------------------------------------------------------
const nigerianPhoneRegex = /^(\+?234|0)[789]\d{9}$/;

// ---------------------------------------------------------------------------
// 1. Request OTP before SAVING a card
//    POST /v1/checkout/user-card/auth
//    Body: { orderReference, phoneNumber }
// ---------------------------------------------------------------------------
export const requestSaveCardAuthSchema = z.object({
  /**
   * The original checkout order reference (UUID).
   * This must be the reference returned when the checkout order was created.
   */
  orderReference: z
    .string("orderReference is required")
    .uuid("orderReference must be a valid UUID")
    .trim(),

  /**
   * The customer's Nigerian mobile phone number.
   * Nomba will SMS the OTP to this number.
   * Accepted formats: 08012345678 | +2348012345678 | 2348012345678
   */
  phoneNumber: z
    .string("phoneNumber is required")
    .trim()
    .regex(
      nigerianPhoneRegex,
      "phoneNumber must be a valid Nigerian mobile number (e.g. 08012345678 or +2348012345678)"
    ),
});

// ---------------------------------------------------------------------------
// 2. Request OTP before FETCHING already-saved cards
//    POST /v1/checkout/user-card/saved-card/auth
//    Body: { orderReference }
// ---------------------------------------------------------------------------
export const requestSavedCardAuthSchema = z.object({
  /**
   * The original checkout order reference (UUID).
   * Nomba uses this to look up the customer's registered mobile number.
   */
  orderReference: z
    .string("orderReference is required")
    .uuid("orderReference must be a valid UUID")
    .trim(),
});

// ---------------------------------------------------------------------------
// 3. Submit user OTP to confirm card save
//    POST /v1/checkout/user-card
//    Body: { orderReference, phoneNumber, otp }
// ---------------------------------------------------------------------------
export const submitUserOtpSchema = z.object({
  /**
   * The original checkout order reference (UUID).
   */
  orderReference: z
    .string("orderReference is required")
    .uuid("orderReference must be a valid UUID")
    .trim(),

  /**
   * The customer's Nigerian mobile phone number.
   * Must match the number used in step 1 (POST /user-card/auth).
   */
  phoneNumber: z
    .string("phoneNumber is required")
    .trim()
    .regex(
      nigerianPhoneRegex,
      "phoneNumber must be a valid Nigerian mobile number (e.g. 08012345678 or +2348012345678)"
    ),

  /**
   * The one-time code received on the customer's mobile phone.
   * Nomba sends a numeric OTP — we accept 4–8 digits defensively.
   */
  otp: z
    .string("otp is required")
    .trim()
    .regex(/^\d{4,8}$/, "otp must be a 4–8 digit numeric code"),
});

// ---------------------------------------------------------------------------
// 4. Update tokenized card — reassign card token to a new email address
//    POST /v1/checkout/tokenized-card-data
//    Body: { tokenKey, currentEmailAddress, newEmailAddress }
// ---------------------------------------------------------------------------
export const updateTokenizedCardSchema = z.object({
  /**
   * The token key returned by Nomba when the card was tokenized.
   * Available from GET /api/tokenized-cards or from webhook data.
   */
  tokenKey: z
    .string("tokenKey is required")
    .min(1, "tokenKey cannot be empty")
    .trim(),

  /**
   * The email address currently associated with this token key in Nomba's
   * vault. Nomba validates this against their records before applying the
   * update — the request will fail if it does not match exactly.
   */
  currentEmailAddress: z
    .string("currentEmailAddress is required")
    .email("currentEmailAddress must be a valid email address")
    .toLowerCase()
    .trim(),

  /**
   * The new email address to associate with this token key going forward.
   * Must be a different value from currentEmailAddress for the update to
   * have any effect (Nomba may reject identical values).
   */
  newEmailAddress: z
    .string("newEmailAddress is required")
    .email("newEmailAddress must be a valid email address")
    .toLowerCase()
    .trim(),
});

// ---------------------------------------------------------------------------
// 5. Delete tokenized card — permanently remove a card from Nomba's vault
//    DELETE /v1/checkout/tokenized-card-data
//    Body: { tokenKey }
// ---------------------------------------------------------------------------
export const deleteTokenizedCardSchema = z.object({
  /**
   * The token key of the card to permanently delete.
   * Once deleted, this tokenKey can no longer be used for charging.
   * This action is IRREVERSIBLE — the customer must go through the full
   * card-save OTP flow again to re-register their card.
   */
  tokenKey: z
    .string("tokenKey is required")
    .min(1, "tokenKey cannot be empty")
    .trim(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------
export type RequestSaveCardAuthInput  = z.infer<typeof requestSaveCardAuthSchema>;
export type RequestSavedCardAuthInput = z.infer<typeof requestSavedCardAuthSchema>;
export type SubmitUserOtpInput        = z.infer<typeof submitUserOtpSchema>;
export type UpdateTokenizedCardInput  = z.infer<typeof updateTokenizedCardSchema>;
export type DeleteTokenizedCardInput  = z.infer<typeof deleteTokenizedCardSchema>;
