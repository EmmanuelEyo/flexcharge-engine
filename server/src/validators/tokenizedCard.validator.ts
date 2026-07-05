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


// ---------------------------------------------------------------------------
// 2. Request OTP before FETCHING already-saved cards
//    POST /v1/checkout/user-card/saved-card/auth
//    Body: { orderReference }
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// 3. Submit user OTP to confirm card save
//    POST /v1/checkout/user-card
//    Body: { orderReference, phoneNumber, otp }
// ---------------------------------------------------------------------------


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



export type UpdateTokenizedCardInput  = z.infer<typeof updateTokenizedCardSchema>;
export type DeleteTokenizedCardInput  = z.infer<typeof deleteTokenizedCardSchema>;

// ---------------------------------------------------------------------------
// 6. Submit customer card details — initiate a direct card payment
//    POST /v1/checkout/checkout-card-detail
//    Body: { cardDetails, key, orderReference, saveCard, deviceInformation }
// ---------------------------------------------------------------------------

/**
 * Schema for the nested cardDetails object.
 * Numbers are sent as-is (Nomba accepts them as integers per their docs).
 */
const cardDetailsSchema = z.object({
  /** CVV / security code on the back of the card */
  cardCVV: z
    .number("cardDetails.cardCVV is required")
    .int("cardDetails.cardCVV must be an integer")
    .min(100, "cardDetails.cardCVV must be at least 3 digits")
    .max(9999, "cardDetails.cardCVV must be at most 4 digits"),

  /** Two-digit expiry month (1–12) */
  cardExpiryMonth: z
    .number("cardDetails.cardExpiryMonth is required")
    .int("cardDetails.cardExpiryMonth must be an integer")
    .min(1, "cardDetails.cardExpiryMonth must be between 1 and 12")
    .max(12, "cardDetails.cardExpiryMonth must be between 1 and 12"),

  /** Four-digit expiry year (current year or later) */
  cardExpiryYear: z
    .number("cardDetails.cardExpiryYear is required")
    .int("cardDetails.cardExpiryYear must be an integer")
    .min(new Date().getFullYear(), "cardDetails.cardExpiryYear must be a current or future year"),

  /** PAN — 13 to 19 digit card number */
  cardNumber: z
    .string("cardDetails.cardNumber is required")
    .trim()
    .regex(/^\d{13,19}$/, "cardDetails.cardNumber must be 13–19 digits"),

  /** 4–6 digit card PIN */
  cardPin: z
    .number("cardDetails.cardPin is required")
    .int("cardDetails.cardPin must be an integer")
    .min(1000, "cardDetails.cardPin must be at least 4 digits")
    .max(999999, "cardDetails.cardPin must be at most 6 digits"),
});

/**
 * Schema for the deviceInformation object.
 * All fields are strings per the Nomba API spec (even boolean flags like
 * httpBrowserJavaEnabled are sent as "true"/"false" strings).
 */
const deviceInformationSchema = z.object({
  httpBrowserLanguage: z
    .string("deviceInformation.httpBrowserLanguage is required")
    .min(2, "deviceInformation.httpBrowserLanguage cannot be empty"),

  httpBrowserJavaEnabled: z
    .string("deviceInformation.httpBrowserJavaEnabled is required")
    .regex(/^(true|false)$/, "deviceInformation.httpBrowserJavaEnabled must be \"true\" or \"false\""),

  httpBrowserJavaScriptEnabled: z
    .string("deviceInformation.httpBrowserJavaScriptEnabled is required")
    .regex(/^(true|false)$/, "deviceInformation.httpBrowserJavaScriptEnabled must be \"true\" or \"false\""),

  httpBrowserColorDepth: z
    .string("deviceInformation.httpBrowserColorDepth is required")
    .min(1, "deviceInformation.httpBrowserColorDepth cannot be empty"),

  httpBrowserScreenHeight: z
    .string("deviceInformation.httpBrowserScreenHeight is required")
    .min(1, "deviceInformation.httpBrowserScreenHeight cannot be empty"),

  httpBrowserScreenWidth: z
    .string("deviceInformation.httpBrowserScreenWidth is required")
    .min(1, "deviceInformation.httpBrowserScreenWidth cannot be empty"),

  httpBrowserTimeDifference: z
    .string("deviceInformation.httpBrowserTimeDifference is required")
    .min(1, "deviceInformation.httpBrowserTimeDifference cannot be empty"),

  userAgentBrowserValue: z
    .string("deviceInformation.userAgentBrowserValue is required")
    .min(1, "deviceInformation.userAgentBrowserValue cannot be empty"),

  deviceChannel: z
    .string("deviceInformation.deviceChannel is required")
    .min(1, "deviceInformation.deviceChannel cannot be empty"),
});



// ---------------------------------------------------------------------------
// 7. Submit customer card OTP — authorize payment after OTP is received
//    POST /v1/checkout/checkout-card-otp
//    Body: { otp, orderReference, transactionId }
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// 8. Resend OTP to customer's phone — retry OTP dispatch
//    POST /v1/checkout/resend-otp
//    Body: { orderReference }
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Inferred TypeScript types for checkout card payment flow
// ---------------------------------------------------------------------------




// ---------------------------------------------------------------------------
// 9. Confirm checkout transaction receipt
//    POST /v1/checkout/confirm-transaction-receipt
//    Body: { orderReference }
//
//    Call this after:
//      - The customer submitted a payment OTP (POST /api/checkout/card-otp), OR
//      - The customer made a bank transfer to the flash account number.
//    Use the response to verify the final payment status and display a receipt.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// 10. Fetch checkout flash account number — path param only, no body
//     GET /v1/checkout/get-checkout-kta/{orderReference}
//
//     The orderReference comes from req.params (not req.body), so we use a
//     separate, reusable schema that validates just the UUID string directly.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Inferred TypeScript types for transaction verification & transfer flow
// ---------------------------------------------------------------------------


