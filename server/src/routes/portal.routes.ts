import { Router } from "express";
import {
  createPortalSession,
  getPortalCustomer,
} from "../controllers/portal.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { portalAuthenticate } from "../middleware/portalAuthenticate.js";

const router = Router();

/**
 * Portal Routes
 *
 * Tenant-authenticated (API key or JWT):
 *   POST /portal/sessions — Generate a portal session token for a customer
 *
 * Portal-authenticated (customer portal JWT):
 *   GET /portal/me — Customer views their profile
 *
 * Additional portal routes (subscription, invoices, cancel, update-payment)
 * will be added during the hackathon when Nomba integration is complete.
 */

// Tenant creates a portal session for their customer
router.post("/sessions", authenticate, createPortalSession);

// Customer self-service routes (protected by portal JWT)
router.get("/me", portalAuthenticate, getPortalCustomer);

export default router;
