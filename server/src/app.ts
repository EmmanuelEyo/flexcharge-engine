import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import basicAuth from "express-basic-auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read swagger spec
let swaggerPath = path.join(__dirname, "./config/swagger.json");
if (!fs.existsSync(swaggerPath)) {
  swaggerPath = path.join(__dirname, "../src/config/swagger.json");
}
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// Dynamically inject production URL from API_BASE_URL environment variable
if (process.env.API_BASE_URL) {
  const baseUrl = process.env.API_BASE_URL.replace(/\/$/, "");
  const prodUrl = `${baseUrl}/api`;

  if (!swaggerDocument.servers) {
    swaggerDocument.servers = [];
  }

  if (!swaggerDocument.servers.some((s: any) => s.url === prodUrl)) {
    if (!prodUrl.includes("localhost") && !prodUrl.includes("127.0.0.1")) {
      swaggerDocument.servers.unshift({
        url: prodUrl,
        description: "Production Server",
      });
    }
  }
}

// Route imports
import authRoutes from "./routes/auth.routes.js";
import planRoutes from "./routes/plan.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import ledgerRoutes from "./routes/ledger.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import tokenizedCardRoutes from "./routes/tokenizedCard.routes.js";
import walletGroupRoutes from "./routes/walletGroup.routes.js";
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

// Trust proxy (required for express-rate-limit behind Render reverse proxies)
app.set("trust proxy", 1);

// ===== SECURITY MIDDLEWARE =====
app.use(helmet()); // Security headers

const allowedOrigins = [
  "https://flexcharge-engine.vercel.app",
  "https://flexcharge-engine.onrender.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      
      // Remove trailing slash if present
      const cleanOrigin = origin.replace(/\/$/, "");
      
      if (allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ===== WEBHOOK ROUTES =====
app.use("/webhooks", webhookRoutes);

// ===== BODY PARSING =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Log request payloads for non-GET requests (redacting sensitive fields automatically)
app.use((req, _res, next) => {
  if (req.method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    logger.info({ body: req.body }, `Request Payload: ${req.method} ${req.url}`);
  }
  next();
});

// ===== RATE LIMITING =====
app.use("/api", apiLimiter);

// ===== REQUEST LOGGING =====
app.use((req, _res, next) => {
  // Prevent health checks from spamming the logs
  if (req.url === "/health") return next();

  logger.info(
    { method: req.method, url: req.url },
    "Incoming request"
  );
  next();
});

// ===== SWAGGER DOCS =====
app.use(
  "/docs",
  basicAuth({
    users: { admin: "hackathon2026" },
    challenge: true,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

// ===== API ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/tokenized-cards", tokenizedCardRoutes);
app.use("/api/wallet-groups", walletGroupRoutes);
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
