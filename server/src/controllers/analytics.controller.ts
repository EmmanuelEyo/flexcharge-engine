import { Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analytics.service.js";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot.js";
import { sendSuccess, sendError, UnauthorizedError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

/**
 * Get real-time top-line KPIs for the dashboard.
 * Requires tenant authentication.
 */
export async function getCurrentAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new UnauthorizedError();
    }

    const metrics = await analyticsService.getCurrentMetrics(tenantId);
    
    sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
}

/**
 * Get historical snapshot data for rendering charts.
 * Query params: days (default 30)
 */
export async function getHistoricalAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId;

    if (!tenantId) {
      throw new UnauthorizedError();
    }

    const daysStr = req.query.days as string;
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    
    if (isNaN(days) || days <= 0 || days > 365) {
      return sendError(res, "Invalid 'days' parameter. Must be between 1 and 365.", 400);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    const snapshots = await AnalyticsSnapshot.find({
      tenantId,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean();

    sendSuccess(res, snapshots);
  } catch (error) {
    next(error);
  }
}
