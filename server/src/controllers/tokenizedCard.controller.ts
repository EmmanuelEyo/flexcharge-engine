import { Request, Response, NextFunction } from "express";
import { nombaService } from "../services/nomba.service.js";
import { sendSuccess, AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

/**
 * Tokenized Card Controller — Wraps Nomba's two tokenized-card read endpoints.
 *
 * These endpoints are read-only and do NOT create or modify any database records.
 * They proxy directly to Nomba, adding:
 *   1. Authentication guard (tenant JWT via middleware)
 *   2. Input validation and meaningful error messages
 *   3. Structured logging for observability
 *   4. Consistent FlexCharge API response envelope
 *
 * Routes:
 *   GET /api/tokenized-cards
 *     → Nomba: GET /v1/checkout/tokenized-card-data
 *     → Lists all of the merchant's tokenized cards (paginated, filterable).
 *
 *   GET /api/tokenized-cards/user/:orderReference
 *     → Nomba: GET /v1/checkout/user-card/{orderReference}
 *     → Returns the saved cards for a specific customer after OTP verification.
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
