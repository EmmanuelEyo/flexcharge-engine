import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Generic Zod validation middleware factory.
 *
 * Usage in routes:
 *   router.post("/plans", validate(createPlanSchema), planController.create);
 *
 * Validates req.body against the provided Zod schema.
 * On failure: returns a 400 with structured field-level error messages.
 * On success: replaces req.body with the parsed (and potentially transformed) data.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and transform — this strips unknown fields and applies defaults
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));

        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: fieldErrors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validate query parameters.
 * Same as validate() but operates on req.query instead of req.body.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.issues.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));

        res.status(400).json({
          success: false,
          error: "Invalid query parameters",
          details: fieldErrors,
        });
        return;
      }
      next(error);
    }
  };
}
