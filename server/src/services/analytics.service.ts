import { Types } from "mongoose";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot.js";
import type { PlanInterval } from "../types/subscription.types.js";

export interface CurrentMetrics {
  mrr: number; // in Kobo
  arr: number; // in Kobo
  activeSubscribers: number;
  arpu: number; // in Kobo
  churnRate: number; // percentage
}

export interface RevenueMetrics {
  grossRevenue: number;
  failedRevenue: number;
}

const AVERAGE_DAYS_PER_MONTH = 365 / 12;

function getMonthlyEquivalentKobo(plan: {
  amount: number;
  interval: string;
  intervalDays?: number | null;
}): number {
  switch (plan.interval as PlanInterval | "daily") {
    case "monthly":
      return plan.amount;
    case "yearly":
      return plan.amount / 12;
    case "quarterly":
      return plan.amount / 3;
    case "weekly":
      return plan.amount * (AVERAGE_DAYS_PER_MONTH / 7);
    case "daily":
      return plan.amount * AVERAGE_DAYS_PER_MONTH;
    case "custom": {
      const days = plan.intervalDays ?? 0;
      if (days <= 0) return 0;
      return plan.amount * (AVERAGE_DAYS_PER_MONTH / days);
    }
    default:
      return 0;
  }
}

export const analyticsService = {
  /**
   * Calculate current MRR, ARR, Active Subs, and ARPU from active subscriptions.
   */
  async getCurrentMetrics(tenantId: string | Types.ObjectId): Promise<CurrentMetrics> {
    const tid = new Types.ObjectId(tenantId);

    const activeSubscriptions = await Subscription.find({
      tenantId: tid,
      status: "active",
    })
      .populate("planId", "amount interval intervalDays")
      .lean();

    const mrr = Math.round(
      activeSubscriptions.reduce((total, sub: any) => {
        const plan = sub.planId;
        if (!plan) return total;

        return total + getMonthlyEquivalentKobo(plan);
      }, 0)
    );

    const activeSubscribers = activeSubscriptions.length;

    const arr = mrr * 12;
    const arpu = activeSubscribers > 0 ? Math.round(mrr / activeSubscribers) : 0;

    // Approximate Churn: Canceled in last 30 days / (Active + Canceled)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledInLast30Days = await Subscription.countDocuments({
      tenantId: tid,
      status: "canceled",
      canceledAt: { $gte: thirtyDaysAgo },
    });

    const totalAtStart = activeSubscribers + canceledInLast30Days;
    const churnRate = totalAtStart > 0 ? (canceledInLast30Days / totalAtStart) * 100 : 0;

    return {
      mrr,
      arr,
      activeSubscribers,
      arpu,
      churnRate: Number(churnRate.toFixed(2)),
    };
  },

  /**
   * Get revenue metrics (gross paid, failed) within a period.
   */
  async getRevenueMetrics(
    tenantId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueMetrics> {
    const tid = new Types.ObjectId(tenantId);

    const paidResult = await Invoice.aggregate([
      {
        $match: {
          tenantId: tid,
          status: "paid",
          paidAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    const failedResult = await Invoice.aggregate([
      {
        $match: {
          tenantId: tid,
          status: "failed",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$amount" },
        },
      },
    ]);

    return {
      grossRevenue: paidResult.length > 0 ? paidResult[0].revenue : 0,
      failedRevenue: failedResult.length > 0 ? failedResult[0].revenue : 0,
    };
  },

  /**
   * Get wallet consumption (credits burned) within a period.
   */
  async getWalletConsumption(
    tenantId: string | Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const tid = new Types.ObjectId(tenantId);

    const result = await WalletTransaction.aggregate([
      {
        $match: {
          tenantId: tid,
          type: "debit",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          consumption: { $sum: "$amount" },
        },
      },
    ]);

    return result.length > 0 ? result[0].consumption : 0;
  },

  /**
   * Take a daily snapshot for a tenant and store it in AnalyticsSnapshot.
   */
  async recordSnapshotForTenant(tenantId: string | Types.ObjectId, date: Date): Promise<void> {
    const tid = new Types.ObjectId(tenantId);
    
    // Calculate start and end of the day for the snapshot's daily metrics
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const currentMetrics = await this.getCurrentMetrics(tid);
    const revenueMetrics = await this.getRevenueMetrics(tid, startOfDay, endOfDay);
    const walletConsumption = await this.getWalletConsumption(tid, startOfDay, endOfDay);

    // Upsert the snapshot for the day
    await AnalyticsSnapshot.findOneAndUpdate(
      { tenantId: tid, date: startOfDay },
      {
        $set: {
          mrr: currentMetrics.mrr,
          arr: currentMetrics.arr,
          activeSubscribers: currentMetrics.activeSubscribers,
          churnRate: currentMetrics.churnRate,
          arpu: currentMetrics.arpu,
          dailyRevenue: revenueMetrics.grossRevenue,
          dailyFailedRevenue: revenueMetrics.failedRevenue,
          dailyWalletConsumption: walletConsumption,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }
};
