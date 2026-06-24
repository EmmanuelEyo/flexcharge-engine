import rateLimit from "express-rate-limit";

/**
 * Rate limiters for different endpoint tiers.
 *
 * Auth endpoints: stricter limits to prevent brute force attacks.
 * General API: higher limits for normal operations.
 */

/** Auth endpoints: 10 requests per minute per IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many authentication attempts. Please try again later.",
  },
});

/** General API: 100 requests per minute per IP */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === "test" ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
});
