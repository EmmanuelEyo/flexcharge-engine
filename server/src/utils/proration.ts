/**
 * Proration Engine — Pure mathematical function for subscription plan changes.
 *
 * Calculates the prorated amounts when a customer upgrades or downgrades
 * their subscription plan mid-cycle. This is a PURE FUNCTION with NO
 * side effects — it does not write to the database.
 *
 * Per AGENTS.md §4.2: "Simulates subscription changes using utils/proration.ts
 * without writing changes to the DB."
 *
 * Per overall_implementation_plan.md §6.4 (Plan Change with Proration)
 * Per feature_implementation_blueprint.md §2
 *
 * All amounts are in KOBO (integers) per AGENTS.md §3.
 */

export interface ProrationInput {
  /** Current plan amount in KOBO */
  currentPlanAmount: number;
  /** New plan amount in KOBO */
  newPlanAmount: number;
  /** Start of the current billing period */
  currentPeriodStart: Date;
  /** End of the current billing period */
  currentPeriodEnd: Date;
  /** The date of the plan change (defaults to now) */
  changeDate?: Date;
}

export interface ProrationResult {
  /** Credit remaining from the unused portion of the current plan (KOBO) */
  unusedCredit: number;
  /** Cost of the new plan for the remaining period (KOBO) */
  newPlanCostForRemaining: number;
  /** Net amount due: positive = upgrade charge, negative = downgrade credit (KOBO) */
  amountDue: number;
  /** Whether this is an upgrade (amountDue > 0) or downgrade (amountDue <= 0) */
  isUpgrade: boolean;
  /** Number of days remaining in the current period */
  daysRemaining: number;
  /** Total number of days in the current billing period */
  totalDaysInPeriod: number;
  /** The proration factor (daysRemaining / totalDaysInPeriod) */
  prorationFactor: number;
  /** Human-readable breakdown for developer UX */
  breakdown: {
    currentPlanDailyRate: number;  // KOBO per day
    newPlanDailyRate: number;      // KOBO per day
    currentPlanAmount: number;     // KOBO
    newPlanAmount: number;         // KOBO
    unusedCredit: number;          // KOBO
    newPlanCostForRemaining: number; // KOBO
    amountDue: number;             // KOBO
  };
}

/**
 * Calculate prorated amounts for a subscription plan change.
 *
 * Per overall_implementation_plan.md §6.4:
 * - daysRemaining = (currentPeriodEnd - today) in days
 * - totalDaysInPeriod = (currentPeriodEnd - currentPeriodStart) in days
 * - unusedCredit = (daysRemaining / totalDaysInPeriod) * oldPlanAmount
 * - newPlanCostForRemaining = (daysRemaining / totalDaysInPeriod) * newPlanAmount
 * - amountDue = newPlanCostForRemaining - unusedCredit
 *
 * @param input - Proration calculation inputs (all amounts in KOBO)
 * @returns Detailed proration result with breakdown
 */
export function calculateProration(input: ProrationInput): ProrationResult {
  const changeDate = input.changeDate || new Date();

  // Calculate days
  const totalDaysInPeriod = daysBetween(
    input.currentPeriodStart,
    input.currentPeriodEnd
  );

  const daysRemaining = daysBetween(changeDate, input.currentPeriodEnd);

  // Guard: if no days in period, no proration needed
  if (totalDaysInPeriod <= 0) {
    return {
      unusedCredit: 0,
      newPlanCostForRemaining: 0,
      amountDue: 0,
      isUpgrade: false,
      daysRemaining: 0,
      totalDaysInPeriod: 0,
      prorationFactor: 0,
      breakdown: {
        currentPlanDailyRate: 0,
        newPlanDailyRate: 0,
        currentPlanAmount: input.currentPlanAmount,
        newPlanAmount: input.newPlanAmount,
        unusedCredit: 0,
        newPlanCostForRemaining: 0,
        amountDue: 0,
      },
    };
  }

  // Clamp daysRemaining to be non-negative
  const effectiveDaysRemaining = Math.max(0, daysRemaining);

  // Calculate proration factor
  const prorationFactor = effectiveDaysRemaining / totalDaysInPeriod;

  // Calculate amounts in KOBO (using Math.round to keep as integers)
  const unusedCredit = Math.round(prorationFactor * input.currentPlanAmount);
  const newPlanCostForRemaining = Math.round(
    prorationFactor * input.newPlanAmount
  );
  const amountDue = newPlanCostForRemaining - unusedCredit;

  // Calculate daily rates for the breakdown
  const currentPlanDailyRate = Math.round(
    input.currentPlanAmount / totalDaysInPeriod
  );
  const newPlanDailyRate = Math.round(
    input.newPlanAmount / totalDaysInPeriod
  );

  return {
    unusedCredit,
    newPlanCostForRemaining,
    amountDue,
    isUpgrade: amountDue > 0,
    daysRemaining: effectiveDaysRemaining,
    totalDaysInPeriod,
    prorationFactor: Math.round(prorationFactor * 10000) / 10000, // 4 decimal places
    breakdown: {
      currentPlanDailyRate,
      newPlanDailyRate,
      currentPlanAmount: input.currentPlanAmount,
      newPlanAmount: input.newPlanAmount,
      unusedCredit,
      newPlanCostForRemaining,
      amountDue,
    },
  };
}

/**
 * Calculate the number of days between two dates (rounded to integer).
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.round((endMs - startMs) / msPerDay);
}
