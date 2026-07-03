import { Router } from "express";
import { getCurrentAnalytics, getHistoricalAnalytics } from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Dashboard (cookie-based/JWT) or Developer API (API Key) authentication
router.use(authenticate);

router.get("/current", getCurrentAnalytics);
router.get("/historical", getHistoricalAnalytics);

export default router;
