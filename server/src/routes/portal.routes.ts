import { Router } from "express";
import {
  createPortalSession,
  getPortalCustomer,
  getPortalSubscription,
  getPortalInvoices,
  requestPaymentMethodUpdate,
  cancelPortalSubscription,
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
 *   GET  /portal/me                      — Customer views their profile
 *   GET  /portal/subscription            — Customer views their subscription
 *   GET  /portal/invoices                — Customer views their invoices
 *   POST /portal/update-payment-method   — Request Nomba checkout link to update card
 *   POST /portal/cancel                  — Customer schedules cancellation
 */

// Tenant creates a portal session for their customer
router.post("/sessions", authenticate, createPortalSession);

// Customer self-service routes (protected by portal JWT)
router.use(portalAuthenticate);

router.get("/me", getPortalCustomer);
router.get("/subscription", getPortalSubscription);
router.get("/invoices", getPortalInvoices);
router.post("/update-payment-method", requestPaymentMethodUpdate);
router.post("/cancel", cancelPortalSubscription);

export default router;
