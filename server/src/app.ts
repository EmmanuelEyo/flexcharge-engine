import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read swagger spec
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./config/swagger.json"), "utf8")
);

// Route imports
import authRoutes from "./routes/auth.routes.js";
import planRoutes from "./routes/plan.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import portalRoutes from "./routes/portal.routes.js";

/**
 * Express Application Setup
 *
 * Assembles all middleware and routes into a single Express app.
 * This is separated from the server startup (index.ts) so the
 * app can be imported independently for testing.
 *
 * Per implementation_plan.md §2 (folder structure)
 */

const app = express();

// ===== SECURITY MIDDLEWARE =====
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? process.env.API_BASE_URL : "*",
    credentials: true,
  })
);

// ===== BODY PARSING =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== RATE LIMITING =====
app.use("/api", apiLimiter);

// ===== REQUEST LOGGING =====
app.use((req, _res, next) => {
  logger.debug(
    { method: req.method, url: req.url },
    "Incoming request"
  );
  next();
});

// ===== SWAGGER DOCS =====
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ===== API ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/portal", portalRoutes);

// ===== HEALTH CHECK =====
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// ===== 404 HANDLER =====
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// ===== ERROR HANDLER (must be last) =====
app.use(errorHandler);

export default app;
