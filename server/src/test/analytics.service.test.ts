import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { analyticsService } from "../services/analytics.service.js";
import { Tenant } from "../models/Tenant.js";
import { Customer } from "../models/Customer.js";
import { Plan } from "../models/Plan.js";
import { Subscription } from "../models/Subscription.js";
import { Invoice } from "../models/Invoice.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { AnalyticsSnapshot } from "../models/AnalyticsSnapshot.js";
import { setupTestDB, clearTestDB, teardownTestDB } from "./setup.js";

let tenantId: mongoose.Types.ObjectId;
let customerId: mongoose.Types.ObjectId;
let monthlyPlanId: mongoose.Types.ObjectId;
let yearlyPlanId: mongoose.Types.ObjectId;

test("Analytics Service", async (t) => {
  await setupTestDB();

  t.beforeEach(async () => {
    await clearTestDB();
    // Create Tenant
    const tenant = await Tenant.create({
      name: "Analytics Test Tenant",
      email: "analytics@example.com",
      passwordHash: "hash"
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    // Create Customer
    const customer = await Customer.create({
      tenantId,
      name: "Test Customer",
      email: "test@example.com",
    });
    customerId = customer._id as mongoose.Types.ObjectId;

    // Create Plans
    const monthlyPlan = await Plan.create({
      tenantId,
      name: "Monthly Pro",
      slug: "monthly-pro-analytics",
      amount: 500000, // 5000 NGN
      interval: "monthly",
    });
    monthlyPlanId = monthlyPlan._id as mongoose.Types.ObjectId;

    const yearlyPlan = await Plan.create({
      tenantId,
      name: "Yearly Pro",
      slug: "yearly-pro-analytics",
      amount: 6000000, // 60000 NGN / year -> 5000 NGN / month
      interval: "yearly",
    });
    yearlyPlanId = yearlyPlan._id as mongoose.Types.ObjectId;
  });

  await t.test("should calculate correct current metrics", async () => {
    // 1 Active Monthly Subscription
    await Subscription.create({
      tenantId,
      customerId,
      planId: monthlyPlanId,
      status: "active",
    });

    // 1 Active Yearly Subscription
    await Subscription.create({
      tenantId,
      customerId,
      planId: yearlyPlanId,
      status: "active",
    });

    // 1 Canceled Subscription
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 15);
    await Subscription.create({
      tenantId,
      customerId,
      planId: monthlyPlanId,
      status: "canceled",
      canceledAt: thirtyDaysAgo,
    });

    const metrics = await analyticsService.getCurrentMetrics(tenantId);
    
    // MRR should be 500000 (monthly) + 6000000/12 (yearly) = 1000000
    assert.strictEqual(metrics.mrr, 1000000);
    // ARR should be 12000000
    assert.strictEqual(metrics.arr, 12000000);
    // Active subscribers should be 2
    assert.strictEqual(metrics.activeSubscribers, 2);
    // ARPU should be 1000000 / 2 = 500000
    assert.strictEqual(metrics.arpu, 500000);
    
    // Churn Rate: 1 canceled, 2 active -> 1 / (1 + 2) = 33.33%
    assert.strictEqual(metrics.churnRate, 33.33);
  });

  await t.test("should calculate correct revenue metrics", async () => {
    const today = new Date();
    
    // 2 Paid Invoices
    await Invoice.create({
      tenantId,
      customerId,
      subscriptionId: new mongoose.Types.ObjectId(),
      amount: 100000,
      status: "paid",
      paidAt: today,
    });
    await Invoice.create({
      tenantId,
      customerId,
      subscriptionId: new mongoose.Types.ObjectId(),
      amount: 200000,
      status: "paid",
      paidAt: today,
    });

    // 1 Failed Invoice
    await Invoice.create({
      tenantId,
      customerId,
      subscriptionId: new mongoose.Types.ObjectId(),
      amount: 50000,
      status: "failed",
    });

    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const metrics = await analyticsService.getRevenueMetrics(tenantId, startOfDay, endOfDay);

    assert.strictEqual(metrics.grossRevenue, 300000); // 100k + 200k
    assert.strictEqual(metrics.failedRevenue, 50000); // 50k
  });

  await t.test("should record a snapshot correctly", async () => {
    // Need to seed some data for the snapshot
    await Subscription.create({
      tenantId,
      customerId,
      planId: monthlyPlanId,
      status: "active",
    });

    const today = new Date();
    await Invoice.create({
      tenantId,
      customerId,
      subscriptionId: new mongoose.Types.ObjectId(),
      amount: 100000,
      status: "paid",
      paidAt: today,
    });

    await analyticsService.recordSnapshotForTenant(tenantId, today);

    const startOfDay = new Date(today);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const snapshot = await AnalyticsSnapshot.findOne({
      tenantId,
      date: startOfDay,
    });

    assert.ok(snapshot, "Snapshot should be created");
    assert.strictEqual(snapshot.mrr, 500000);
    assert.strictEqual(snapshot.dailyRevenue, 100000);
  });

  await teardownTestDB();
});
