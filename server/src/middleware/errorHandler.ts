import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/environment.js";

/**
 * Centralized error handling middleware.
 *
 * Catches all errors thrown in controllers/services and returns
 * a consistent JSON error response. Distinguishes between:
 * - Operational errors (AppError): Expected failures (validation, auth, not found)
 * - Programming errors: Unexpected bugs that should be logged and investigated
 *
 * SECURITY: In production, programming errors return a generic message
 * to avoid leaking internal details to attackers.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Mongoose validation error
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: "Validation failed",
      details: err.message,
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern || {})[0] || "field";
    res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists`,
    });
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    res.status(400).json({
      success: false,
      error: "Invalid ID format",
    });
    return;
  }

  // Our custom application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Unexpected programming error
  logger.error({ err, stack: err.stack }, "Unhandled error");

  res.status(500).json({
    success: false,
    error:
      env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
  });
}
