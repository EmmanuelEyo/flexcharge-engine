import { Request, Response, NextFunction } from "express";
import { nombaService } from "../services/nomba.service.js";
import { sendSuccess, AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import {
  requestSaveCardAuthSchema,
  requestSavedCardAuthSchema,
  submitUserOtpSchema,
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
// GET USER SAVED CARDS (OTP-gated)
// Charge: GET /v1/checkout/user-card/{orderReference}
// ============================================================

/**
 * GET /api/tokenized-cards/user/:orderReference
 *
 * Retrieves the saved cards for a specific customer.
 *
 * This endpoint is OTP-gated — Nomba requires the merchant to:
 *  1. First call POST /v1/checkout/user-card/saved-card/auth (not yet implemented)
 *     → Nomba sends an OTP to the customer's registered mobile number
 *  2. Then call this endpoint with that OTP in the `otp` query param
 *     → Nomba validates the OTP and returns the customer's saved cards
 *
 * This two-step design prevents unauthenticated access to stored card details.
 *
 * Path Parameters:
 *   - orderReference: string (required) — The original checkout order reference
 *
 * Query Parameters:
 *   - otp: string (required) — OTP sent to customer's mobile number
 *
 * Response:
 *   {
 *     tokenizedCardData: Array — the customer's saved card records
 *     total:             number
 *   }
 *
 * Usage example:
 *   GET /api/tokenized-cards/user/90e81e8a-bc14-4ebf-89c0-57da752cca58?otp=123456
 */
export async function getUserSavedCards(
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

    const orderReference = req.params["orderReference"] as string;
    const otp = req.query["otp"] as string | undefined;

    // Validate required params
    if (!orderReference || orderReference.trim() === "") {
      throw new AppError(
        "Path param 'orderReference' is required.",
        400
      );
    }

    if (!otp || otp.trim() === "") {
      throw new AppError(
        "Query param 'otp' is required. Call POST /checkout/user-card/saved-card/auth first to trigger OTP delivery to the customer.",
        400
      );
    }

    logger.info(
      {
        tenantId: req.tenantId,
        orderReference,
        // Never log the OTP value itself
        otpProvided: true,
      },
      "getUserSavedCards: proxying to Nomba"
    );

    const result = await nombaService.getUserSavedCards(orderReference, otp);

    sendSuccess(res, {
      orderReference,
      tokenizedCardData: result.tokenizedCardData,
      total:             result.total,
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
export async function requestSaveCardAuth(
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

    // Validate body against Zod schema
    const parsed = requestSaveCardAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError(`Validation failed — ${messages}`, 400);
    }

    const { orderReference, phoneNumber } = parsed.data;

    logger.info(
      {
        tenantId:       req.tenantId,
        orderReference,
        // Mask the phone — only log the last 4 digits
        phoneTail:      phoneNumber.slice(-4),
      },
      "requestSaveCardAuth: triggering Nomba OTP for card-save"
    );

    const result = await nombaService.requestSaveCardAuth(orderReference, phoneNumber);

    sendSuccess(res, {
      success:        result.success,
      message:        result.message,
      orderReference,
      // Helpful hint for the calling client on what to do next
      nextStep: "Submit the OTP the customer received via POST /api/tokenized-cards/user-card",
    });
  } catch (error) {
    next(error);
  }
}

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
export async function requestSavedCardAuth(
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

    // Validate body against Zod schema
    const parsed = requestSavedCardAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError(`Validation failed — ${messages}`, 400);
    }

    const { orderReference } = parsed.data;

    logger.info(
      {
        tenantId: req.tenantId,
        orderReference,
      },
      "requestSavedCardAuth: triggering Nomba OTP for saved-card fetch"
    );

    const result = await nombaService.requestSavedCardAuth(orderReference);

    sendSuccess(res, {
      success:        result.success,
      message:        result.message,
      orderReference,
      nextStep: "Submit the OTP the customer received via GET /api/tokenized-cards/user/:orderReference?otp=<otp>",
    });
  } catch (error) {
    next(error);
  }
}

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
export async function submitUserOtp(
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

    // Validate body against Zod schema
    const parsed = submitUserOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
        .join("; ");
      throw new AppError(`Validation failed — ${messages}`, 400);
    }

    const { orderReference, phoneNumber, otp } = parsed.data;

    logger.info(
      {
        tenantId:       req.tenantId,
        orderReference,
        phoneTail:      phoneNumber.slice(-4),
        // NEVER log OTP values — only log that one was provided
        otpProvided:    true,
      },
      "submitUserOtp: submitting customer OTP to Nomba for card save"
    );

    const result = await nombaService.submitUserOtp(orderReference, phoneNumber, otp);

    sendSuccess(res, {
      success:        result.success,
      message:        result.message,
      orderReference,
    });
  } catch (error) {
    next(error);
  }
}

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
