import { Response } from "express";

/**
 * Standardized API response helpers.
 *
 * Every response from FlexCharge follows this shape:
 * {
 *   success: boolean,
 *   data?: T,
 *   error?: string,
 *   meta?: { page, limit, total }
 * }
 *
 * This ensures downstream teams always get a predictable response format.
 */

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: PaginationMeta
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400
): void {
  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Custom application error class with HTTP status codes.
 * Thrown from controllers/services and caught by the error handler middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409);
  }
}
