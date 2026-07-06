import { Router } from "express";
import {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomerPaymentMethod,
  setCustomerDefaultPaymentMethod,
} from "../controllers/customer.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customer.validator.js";

const router = Router();

/**
 * Customer Routes — All require authentication (API key or JWT).
 *
 * POST   /customers       — Create a new customer
 * GET    /customers       — List customers (paginated, search by ?email=)
 * GET    /customers/:id   — Get a single customer
 * PATCH  /customers/:id   — Update customer info
 */

router.use(authenticate);

router.post("/", validate(createCustomerSchema), createCustomer);
router.get("/", listCustomers);
router.get("/:id", getCustomer);
router.patch("/:id", validate(updateCustomerSchema), updateCustomer);
router.delete("/:customerId/payment-methods/:id", deleteCustomerPaymentMethod);
router.put("/:customerId/payment-methods/:id/default", setCustomerDefaultPaymentMethod);

export default router;
