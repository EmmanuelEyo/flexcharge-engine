import test from "node:test";
import assert from "node:assert";
import { setupTestDB, clearTestDB, teardownTestDB } from "./setup.js";
import { calculateProration } from "../utils/proration.js";

/**
 * Proration Engine Tests
 *
 * Verifies the pure mathematical calculations for plan upgrades and downgrades,
 * ensuring all amounts remain as exact KOBO integers.
 *
 * Per feature_implementation_blueprint.md §2 (Proration dry-runs)
 */

test("Proration Engine", async (t) => {
  // Proration is a pure function, so we don't strictly need the DB,
  // but we follow the standard test suite pattern anyway.
  await setupTestDB();

  await t.test(
    "calculates exact upgrade amount (mid-cycle, 50% remaining)",
    () => {
      // 30 day period
      const currentPeriodStart = new Date("2026-06-01T00:00:00Z");
      const currentPeriodEnd = new Date("2026-07-01T00:00:00Z");
      const changeDate = new Date("2026-06-16T00:00:00Z"); // Exactly 15 days in

      const result = calculateProration({
        currentPlanAmount: 500000, // 5000 NGN
        newPlanAmount: 1000000, // 10000 NGN
        currentPeriodStart,
        currentPeriodEnd,
        changeDate,
      });

      // 30 days total, 15 days remaining -> 50% factor
      assert.strictEqual(result.totalDaysInPeriod, 30);
      assert.strictEqual(result.daysRemaining, 15);
      assert.strictEqual(result.prorationFactor, 0.5);

      // Unused credit: 50% of 5000 NGN = 2500 NGN
      assert.strictEqual(result.unusedCredit, 250000);

      // New cost: 50% of 10000 NGN = 5000 NGN
      assert.strictEqual(result.newPlanCostForRemaining, 500000);

      // Amount due: 5000 - 2500 = +2500 NGN
      assert.strictEqual(result.amountDue, 250000);
      assert.strictEqual(result.isUpgrade, true);
    }
  );

  await t.test(
    "calculates exact downgrade credit (late-cycle, 10% remaining)",
    () => {
      // 30 day period
      const currentPeriodStart = new Date("2026-06-01T00:00:00Z");
      const currentPeriodEnd = new Date("2026-07-01T00:00:00Z");
      const changeDate = new Date("2026-06-28T00:00:00Z"); // 27 days in, 3 days remaining

      const result = calculateProration({
        currentPlanAmount: 1000000, // 10000 NGN
        newPlanAmount: 500000, // 5000 NGN
        currentPeriodStart,
        currentPeriodEnd,
        changeDate,
      });

      assert.strictEqual(result.totalDaysInPeriod, 30);
      assert.strictEqual(result.daysRemaining, 3);
      assert.strictEqual(result.prorationFactor, 0.1);

      // Unused credit: 10% of 10000 NGN = 1000 NGN
      assert.strictEqual(result.unusedCredit, 100000);

      // New cost: 10% of 5000 NGN = 500 NGN
      assert.strictEqual(result.newPlanCostForRemaining, 50000);

      // Amount due: 500 - 1000 = -500 NGN (Credit)
      assert.strictEqual(result.amountDue, -50000);
      assert.strictEqual(result.isUpgrade, false);
    }
  );

  await t.test("handles 0 days remaining gracefully", () => {
    const currentPeriodStart = new Date("2026-06-01T00:00:00Z");
    const currentPeriodEnd = new Date("2026-07-01T00:00:00Z");
    const changeDate = new Date("2026-07-01T00:00:00Z"); // End of period

    const result = calculateProration({
      currentPlanAmount: 500000,
      newPlanAmount: 1000000,
      currentPeriodStart,
      currentPeriodEnd,
      changeDate,
    });

    assert.strictEqual(result.daysRemaining, 0);
    assert.strictEqual(result.prorationFactor, 0);
    assert.strictEqual(result.amountDue, 0);
    assert.strictEqual(result.unusedCredit, 0);
    assert.strictEqual(result.isUpgrade, false); // Not technically an upgrade charge for this cycle
  });

  await teardownTestDB();
});
