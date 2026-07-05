import { Request, Response, NextFunction } from "express";
import { nombaService } from "../services/nomba.service.js";
import { sendSuccess, AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import {
  updateTokenizedCardSchema,
  deleteTokenizedCardSchema,
} from "../validators/tokenizedCard.validator.js";


/**
 * Tokenized Card Controller — Wraps Nomba's tokenized-card endpoints.
 *
 * These endpoints proxy directly to Nomba, adding:
 *   1. Authentication guard (tenant JWT / API key via middleware)
 *   2. Zod input validation with meaningful error messages
 *   3. Structured logging for observability
 *   4. Consistent FlexCharge API response envelope
 *
 * Routes:
 *   GET  /api/tokenized-cards
 *     → Nomba: GET  /v1/checkout/tokenized-card-data
 *     → Lists all of the merchant's tokenized cards (paginated, filterable).
 *
 *   GET  /api/tokenized-cards/user/:orderReference
 *     → Nomba: GET  /v1/checkout/user-card/{orderReference}
 *     → Returns a customer's saved cards after OTP verification.
 *
 *   POST /api/tokenized-cards/user-card/auth
 *     → Nomba: POST /v1/checkout/user-card/auth
 *     → Triggers an OTP SMS to authenticate the user before saving their card.
 *     → Call this AFTER a successful payment where the user opted to save their card.
 *
 *   POST /api/tokenized-cards/user-card/saved-card/auth
 *     → Nomba: POST /v1/checkout/user-card/saved-card/auth
 *     → Triggers an OTP SMS to authenticate the user before fetching saved cards.
 *     → Call this when getCheckoutOrder() returns hasSavedCards === true.
 *
 *   POST /api/tokenized-cards/user-card
 *     → Nomba: POST /v1/checkout/user-card
 *     → Submits the OTP received by the customer to confirm and complete card save.
 *
 * Per Nomba API docs (Online Checkout + Charge sections)
 */

// ============================================================
// LIST MERCHANT TOKENIZED CARDS
// Online Checkout: GET /v1/checkout/tokenized-card-data
// ============================================================

/**
 * GET /api/tokenized-cards
 *
 * Fetches the merchant's full list of tokenized cards from Nomba.
 * Supports optional query-level filtering and cursor-based pagination.
 *
 * Query Parameters (all optional):
 *   - customerEmail: string  — Filter by customer email address
 *   - startDate:     string  — ISO date string for token creation window start
 *   - endDate:       string  — ISO date string for token creation window end
 *   - page:          integer — 0-indexed page number (omit for first page)
 *
 * Response:
 *   {
 *     nextPage:              string  — cursor for next page ("0" = no more pages)
 *     tokenizedCardDataList: Array   — the card records
 *     total:                 number  — count of records in this page
 *   }
 *
 * Usage example:
 *   GET /api/tokenized-cards?customerEmail=user@example.com&page=0
 */
export async function listTokenizedCards(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Guard: Nomba must be configured
    if (!nombaService.isConfigured()) {
      throw new AppError(
        "Nomba integration is not configured. Set NOMBA_CLIENT_ID and NOMBA_CLIENT_SECRET.",
        503
      );
    }

    // Extract and validate optional query params
    const { customerEmail, startDate, endDate, page: pageRaw } = req.query;

    let page: number | undefined;
    if (pageRaw !== undefined) {
      page = parseInt(pageRaw as string, 10);
      if (isNaN(page) || page < 0) {
        throw new AppError(
          "Invalid 'page' query param — must be a non-negative integer.",
          400
        );
      }
    }

    const params = {
      customerEmail: customerEmail as string | undefined,
      startDate:     startDate     as string | undefined,
      endDate:       endDate       as string | undefined,
      page,
    };

    logger.info(
      { tenantId: req.tenantId, filters: params },
      "listTokenizedCards: proxying to Nomba"
    );

    const result = await nombaService.listTokenizedCards(params);

    sendSuccess(res, {
      nextPage:              result.nextPage,
      tokenizedCardDataList: result.tokenizedCardDataList,
      total:                 result.total,
      // Convenience flag for callers building infinite-scroll UIs
      hasMore: result.nextPage !== "0" && result.nextPage !== "",
    });
  } catch (error) {
    next(error);
  }
}


// ============================================================
// REQUEST OTP — BEFORE SAVING A CARD
// Charge: POST /v1/checkout/user-card/auth
// ============================================================

/**
 * POST /api/tokenized-cards/user-card/auth
 *
 * Triggers Nomba to send an OTP SMS to the customer's registered phone
 * number, authenticating them before their card is saved for later use.
 *
 * WHEN TO CALL:
 *   After a successful checkout payment AND the customer has opted to save
 *   their card for future recurring charges. Call this endpoint first, then
 *   wait for the customer to receive and forward the OTP, then call
 *   POST /api/tokenized-cards/user-card (submitUserOtp) to finalize the save.
 *
 * Request Body:
 *   {
 *     orderReference: string  (UUID)  — the original checkout order reference
 *     phoneNumber:    string          — customer's mobile number e.g. "08012345678"
 *   }
 *
 * Response:
 *   {
 *     success: boolean — true when Nomba dispatched the OTP successfully
 *     message: string  — human-readable confirmation e.g. "success"
 *   }
 *
 * Errors:
 *   400 — missing/invalid body fields
 *   503 — Nomba integration not configured
 */


// ============================================================
// REQUEST OTP — BEFORE FETCHING SAVED CARDS
// Charge: POST /v1/checkout/user-card/saved-card/auth
// ============================================================

/**
 * POST /api/tokenized-cards/user-card/saved-card/auth
 *
 * Triggers Nomba to send an OTP SMS to the customer's registered phone
 * number, authenticating them before their previously saved cards are
 * retrieved.
 *
 * WHEN TO CALL:
 *   When GET /api/checkout/orders/:orderReference returns hasSavedCards === true.
 *   Call this endpoint first, then wait for the OTP, then call
 *   GET /api/tokenized-cards/user/:orderReference?otp=<otp> to retrieve cards.
 *
 * Request Body:
 *   {
 *     orderReference: string  (UUID)  — the original checkout order reference
 *   }
 *
 * Response:
 *   {
 *     success: boolean — true when Nomba dispatched the OTP successfully
 *     message: string  — human-readable confirmation e.g. "success"
 *   }
 *
 * Errors:
 *   400 — missing/invalid body fields
 *   503 — Nomba integration not configured
 */


// ============================================================
// SUBMIT USER OTP — COMPLETE CARD SAVE
// Charge: POST /v1/checkout/user-card
// ============================================================

/**
 * POST /api/tokenized-cards/user-card
 *
 * Submits the OTP the customer received on their mobile phone to Nomba.
 * On success, Nomba tokenizes and stores the card.
 *
 * This is the FINAL step of the card-saving OTP flow:
 *   Step 1 — POST /api/tokenized-cards/user-card/auth          → Trigger OTP
 *   Step 2 — (customer receives OTP via SMS)
 *   Step 3 — POST /api/tokenized-cards/user-card  (this)       → Submit OTP
 *
 * After this succeeds, the card token key will appear in future calls to
 * GET /api/tokenized-cards or GET /api/tokenized-cards/user/:orderReference
 * and can be used for recurring charges via the tokenized-card-payment endpoint.
 *
 * Request Body:
 *   {
 *     orderReference: string  (UUID)  — the original checkout order reference
 *     phoneNumber:    string          — customer's mobile number e.g. "08012345678"
 *     otp:            string          — 4–8 digit OTP received via SMS
 *   }
 *
 * Response:
 *   {
 *     success: boolean — true when the card was saved successfully
 *     message: string  — human-readable confirmation e.g. "success"
 *   }
 *
 * Errors:
 *   400 — missing/invalid body fields, invalid OTP format
 *   503 — Nomba integration not configured
 */


// ============================================================
// UPDATE TOKENIZED CARD
// Online Checkout: POST /v1/checkout/tokenized-card-data
// ============================================================

/**
 * POST /api/tokenized-cards
 *
 * Updates the email address associated with a specific tokenized card.
 *
 * Nomba validates that `currentEmailAddress` exactly matches the email
 * on record for the given `tokenKey` before applying the update.
 * If there is a mismatch, Nomba will return an error.
 *
 * USE CASES:
 *   - Customer updates their email in the merchant's app
 *   - Merging duplicate customer accounts under a new email
 *   - Correcting a typo in the customer's original email
 *
 * Request Body:
 *   {
 *     tokenKey:            string  — the Nomba token key to update
 *     currentEmailAddress: string  — email currently on record in Nomba's vault
 *     newEmailAddress:     string  — new email to associate with the token
 *   }
 *
 * Response:
 *   {
 *     status:            boolean             — true when update was successful
 *     message:           string              — e.g. "email@email.com" (the new email)
 *     tokenizedCardData: TokenizedCardItem[] — updated card records for this token
 *   }
 *
 * Errors:
 *   400 — validation failure or email mismatch
 *   503 — Nomba integration not configured
 */
export async function updateTokenizedCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!nombaService.isConfigured()) {
      throw new AppError(
        "Nomba integration is not configured. Set NOMBA_CLIENT_ID and NOMBA_CLIENT_SECRET.",
        503
      );
    }

    const parsed = updateTokenizedCardSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError(`Validation failed — ${messages}`, 400);
    }

    const { tokenKey, currentEmailAddress, newEmailAddress } = parsed.data;

    logger.info(
      {
        tenantId: req.tenantId,
        tokenKey,
        // Never log full email addresses in plaintext — mask the local part
        currentEmailTail: currentEmailAddress.split("@")[1],
        newEmailTail:     newEmailAddress.split("@")[1],
      },
      "updateTokenizedCard: proxying update request to Nomba"
    );

    const result = await nombaService.updateTokenizedCard({
      tokenKey,
      currentEmailAddress,
      newEmailAddress,
    });

    sendSuccess(res, {
      status:            result.status,
      message:           result.message,
      tokenizedCardData: result.tokenizedCardData,
      total:             result.tokenizedCardData.length,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// DELETE TOKENIZED CARD
// Online Checkout: DELETE /v1/checkout/tokenized-card-data
// ============================================================

/**
 * DELETE /api/tokenized-cards
 *
 * Permanently removes a tokenized card from Nomba's vault.
 *
 * ⚠️  IRREVERSIBLE: Once deleted, the `tokenKey` is invalidated and
 * can no longer be used for recurring charges. The customer must go
 * through the full card-save OTP flow again to re-register their card.
 *
 * USE CASES:
 *   - Customer explicitly requests card removal (GDPR/NDPR compliance)
 *   - Merchant cleaning up expired or invalid tokens
 *   - Regulatory or compliance-mandated PII purging
 *
 * Request Body:
 *   {
 *     tokenKey: string — the Nomba token key of the card to delete
 *   }
 *
 * Response:
 *   {
 *     status:  boolean — true when the card was deleted successfully
 *     message: string  — e.g. "success"
 *   }
 *
 * Errors:
 *   400 — missing or invalid tokenKey
 *   503 — Nomba integration not configured
 */
export async function deleteTokenizedCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!nombaService.isConfigured()) {
      throw new AppError(
        "Nomba integration is not configured. Set NOMBA_CLIENT_ID and NOMBA_CLIENT_SECRET.",
        503
      );
    }

    const parsed = deleteTokenizedCardSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError(`Validation failed — ${messages}`, 400);
    }

    const { tokenKey } = parsed.data;

    logger.info(
      {
        tenantId: req.tenantId,
        tokenKey,
      },
      "deleteTokenizedCard: proxying delete request to Nomba"
    );

    const result = await nombaService.deleteTokenizedCard(tokenKey);

    sendSuccess(res, {
      status:  result.status,
      message: result.message,
      tokenKey,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================
// SUBMIT CUSTOMER CARD DETAILS
// Charge: POST /v1/checkout/checkout-card-detail
// ============================================================

/**
 * POST /api/checkout/card-detail
 *
 * Submits the customer's card credentials to Nomba to initiate a direct
 * card-payment transaction. This is the entry point of the embedded/direct
 * card-payment flow (as opposed to the hosted Nomba checkout page).
 *
 * RESPONSE CODE SEMANTICS (data.responseCode):
 *   "00" — Payment complete. No further steps required.
 *   "T0" — Nomba dispatched an OTP to the customer's phone.
 *           Next: POST /api/checkout/card-otp with the otp + transactionId.
 *   "S0" — 3D Secure authentication is required.
 *           Next: Redirect the customer to data.secureAuthenticationData.acsUrl.
 *
 * CARD SAVE FLOW: If saveCard=true in the request, the card will only be
 * fully tokenized AFTER the customer completes the card-save OTP flow:
 *   → POST /api/tokenized-cards/user-card/auth  (trigger card-save OTP)
 *   → POST /api/tokenized-cards/user-card       (submit card-save OTP)
 *
 * Request Body:
 *   {
 *     cardDetails: {
 *       cardCVV:          number   — 3–4 digit CVV
 *       cardExpiryMonth:  number   — 1–12
 *       cardExpiryYear:   number   — current year or later
 *       cardNumber:       string   — 13–19 digit PAN
 *       cardPin:          number   — 4–6 digit PIN
 *     }
 *     key:              string   — RSA encryption key or empty string ""
 *     orderReference:   string   — UUID from POST /v1/checkout/order
 *     saveCard:         boolean  — whether to save card for future use
 *     deviceInformation: {
 *       httpBrowserLanguage:          string   e.g. "en-GB"
 *       httpBrowserJavaEnabled:       string   "true" | "false"
 *       httpBrowserJavaScriptEnabled: string   "true" | "false"
 *       httpBrowserColorDepth:        string   e.g. "30"
 *       httpBrowserScreenHeight:      string   e.g. "900"
 *       httpBrowserScreenWidth:       string   e.g. "1500"
 *       httpBrowserTimeDifference:    string   e.g. "-60"
 *       userAgentBrowserValue:        string   browser user agent
 *       deviceChannel:                string   e.g. "Browser"
 *     }
 *   }
 *
 * Response:
 *   {
 *     status:        boolean — true when submission was accepted
 *     message:       string  — human-readable status
 *     responseCode:  string  — "00" | "T0" | "S0"
 *     transactionId: string  — use in subsequent checkout-card-otp call
 *     nextAction:    string  — human-readable next-step hint
 *     secureAuthenticationData?: { jwt, md, acsUrl, termUrl }
 *   }
 *
 * Errors:
 *   400 — validation failure (missing fields, invalid card number format, etc.)
 *   503 — Nomba integration not configured
 */


// ============================================================
// SUBMIT CUSTOMER CARD OTP (Payment Authorization OTP)
// Charge: POST /v1/checkout/checkout-card-otp
// ============================================================

/**
 * POST /api/checkout/card-otp
 *
 * Submits the payment OTP that Nomba dispatched to the customer's phone
 * during the card-detail submission step (when responseCode was "T0").
 *
 * ⚠️  IMPORTANT: This is the PAYMENT authorization OTP — it is completely
 * separate from the card-SAVE OTP flow that uses:
 *   POST /api/tokenized-cards/user-card/auth   (trigger card-save OTP)
 *   POST /api/tokenized-cards/user-card         (submit card-save OTP)
 *
 * WHEN TO CALL:
 *   Only when POST /api/checkout/card-detail returned { responseCode: "T0" }.
 *   The transactionId from that response must be included here.
 *
 * Request Body:
 *   {
 *     otp:            string   — 4–8 digit OTP from the customer's phone
 *     orderReference: string   — the original checkout order reference UUID
 *     transactionId:  string   — returned by POST /api/checkout/card-detail
 *   }
 *
 * Response:
 *   {
 *     status:        boolean — true when the OTP was accepted and payment authorized
 *     message:       string  — e.g. "success"
 *     orderReference: string
 *     transactionId:  string
 *   }
 *
 * Errors:
 *   400 — validation failure or invalid/expired OTP
 *   503 — Nomba integration not configured
 */


// ============================================================
// RESEND OTP TO CUSTOMER'S PHONE
// Charge: POST /v1/checkout/resend-otp
// ============================================================

/**
 * POST /api/checkout/resend-otp
 *
 * Re-triggers the payment OTP dispatch to the customer's phone.
 * Call this when the customer has not received or has lost the OTP that
 * was sent during card-detail submission (when responseCode was "T0").
 *
 * Nomba will re-send the OTP to the mobile number registered with the order.
 *
 * WHEN TO CALL:
 *   Only after POST /api/checkout/card-detail returned { responseCode: "T0" }
 *   and the customer reports not receiving the OTP. This avoids the customer
 *   having to re-enter their card details.
 *
 * Request Body:
 *   {
 *     orderReference: string — the original checkout order reference UUID
 *   }
 *
 * Response:
 *   {
 *     success:        boolean — true when Nomba dispatched the OTP again
 *     message:        string  — e.g. "success"
 *     orderReference: string
 *     nextStep:       string  — reminder to submit via POST /api/checkout/card-otp
 *   }
 *
 * Errors:
 *   400 — validation failure (missing or invalid orderReference)
 *   503 — Nomba integration not configured
 */


// ============================================================
// CONFIRM CHECKOUT TRANSACTION RECEIPT
// POST /v1/checkout/confirm-transaction-receipt
// ============================================================

/**
 * POST /api/checkout/confirm-transaction-receipt
 *
 * Fetches the checkout transaction details and confirms the final payment
 * status after the customer has either:
 *   (a) Submitted a payment OTP (following POST /api/checkout/card-otp), OR
 *   (b) Made a bank transfer to the flash account number.
 *
 * This is the canonical way to get the authoritative payment status from
 * Nomba. Use the returned `order` object to:
 *   - Display a success/failure receipt to the customer
 *   - Update your internal order records
 *   - Trigger post-payment webhooks or subscription activations
 *
 * ⚠️  POLLING: Do NOT call this endpoint in a tight loop.
 * Wait for the customer to finish their action, then call once.
 * If still pending, use exponential backoff or await a Nomba webhook.
 *
 * Request Body:
 *   {
 *     orderReference: string — the original checkout order reference UUID
 *   }
 *
 * Response (data):
 *   {
 *     status:         boolean — true when payment was successful
 *     message:        string
 *     orderReference: string
 *     order: {
 *       orderId, orderReference, customerId, accountId,
 *       callbackUrl, customerEmail, amount, currency,
 *       businessName, businessEmail, businessLogo
 *     } | null
 *   }
 *
 * Errors:
 *   400 — validation failure
 *   503 — Nomba integration not configured
 */

