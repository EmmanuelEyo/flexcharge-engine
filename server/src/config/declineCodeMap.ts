/**
 * Decline Code Map — ISO 8583 decline code classification.
 *
 * Maps ISO 8583 response codes from Nomba to human-readable categories,
 * decline types (soft vs hard), retry strategies, and customer-facing messages.
 *
 * Per AGENTS.md §4.3: "Uses declineCodeMap.ts to schedule retry timings
 * aligned with paydays (1st and 15th) for insufficient funds errors."
 *
 * Per feature_implementation_blueprint.md §3.1 (Comprehensive Decline Code Mapping)
 */

export interface DeclineClassification {
  code: string;
  category: string;
  type: "soft" | "hard";
  retryStrategy: "payday_aligned" | "immediate" | "exponential" | "none";
  customerAction: string;
  description: string;
}

/**
 * ISO 8583 decline code to classification mapping.
 *
 * Categories:
 * - insufficient_funds: Customer's account doesn't have enough money
 * - card_expired: Card has passed its expiration date
 * - card_restricted: Card blocked, stolen, or restricted
 * - do_not_honor: Issuer declined without specific reason
 * - technical: Network/processing error (transient)
 * - fraud: Suspected fraudulent transaction
 * - limit_exceeded: Transaction exceeds card/account limits
 * - invalid_card: Invalid card number or CVV
 */
const DECLINE_CODE_MAP: Record<string, DeclineClassification> = {
  // === INSUFFICIENT FUNDS (Soft — payday aligned) ===
  "51": {
    code: "51",
    category: "insufficient_funds",
    type: "soft",
    retryStrategy: "payday_aligned",
    customerAction:
      "Your account balance is too low. Please fund your account and we'll retry on the next payday.",
    description: "Insufficient funds",
  },
  "N4": {
    code: "N4",
    category: "insufficient_funds",
    type: "soft",
    retryStrategy: "payday_aligned",
    customerAction:
      "Your account balance is too low. Please fund your account and we'll retry on the next payday.",
    description: "Exceeds issuer withdrawal limit (treated as insufficient funds)",
  },

  // === DO NOT HONOR (Soft — exponential backoff) ===
  "05": {
    code: "05",
    category: "do_not_honor",
    type: "soft",
    retryStrategy: "exponential",
    customerAction:
      "Your bank declined this transaction. Please contact your bank or try a different card.",
    description: "Do not honor",
  },

  // === CARD EXPIRED (Hard — no retry) ===
  "54": {
    code: "54",
    category: "card_expired",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "Your card has expired. Please update your payment method with a valid card.",
    description: "Expired card",
  },
  "33": {
    code: "33",
    category: "card_expired",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "Your card has expired. Please update your payment method with a valid card.",
    description: "Expired card (alternate code)",
  },

  // === CARD RESTRICTED / STOLEN (Hard — no retry) ===
  "36": {
    code: "36",
    category: "card_restricted",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "Your card has been restricted. Please contact your bank or use a different card.",
    description: "Restricted card",
  },
  "41": {
    code: "41",
    category: "card_restricted",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "This card has been reported as lost. Please use a different payment method.",
    description: "Lost card — pick up",
  },
  "43": {
    code: "43",
    category: "card_restricted",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "This card has been flagged. Please contact your bank or use a different card.",
    description: "Stolen card — pick up",
  },

  // === FRAUD (Hard — no retry) ===
  "59": {
    code: "59",
    category: "fraud",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "This transaction was declined for security reasons. Please contact your bank.",
    description: "Suspected fraud",
  },
  "63": {
    code: "63",
    category: "fraud",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "This transaction was declined for security reasons. Please contact your bank.",
    description: "Security violation",
  },

  // === LIMIT EXCEEDED (Soft — exponential backoff) ===
  "61": {
    code: "61",
    category: "limit_exceeded",
    type: "soft",
    retryStrategy: "exponential",
    customerAction:
      "You've exceeded your card's transaction limit. Please try again later or contact your bank.",
    description: "Exceeds withdrawal amount limit",
  },
  "65": {
    code: "65",
    category: "limit_exceeded",
    type: "soft",
    retryStrategy: "exponential",
    customerAction:
      "You've exceeded your card's daily transaction limit. We'll retry tomorrow.",
    description: "Exceeds withdrawal frequency limit",
  },

  // === INVALID CARD (Hard — no retry) ===
  "14": {
    code: "14",
    category: "invalid_card",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "The card number is invalid. Please check and update your payment method.",
    description: "Invalid card number",
  },
  "N7": {
    code: "N7",
    category: "invalid_card",
    type: "hard",
    retryStrategy: "none",
    customerAction:
      "The CVV provided is incorrect. Please update your payment method.",
    description: "CVV2 value supplied is invalid",
  },

  // === TECHNICAL / NETWORK (Soft — immediate retry) ===
  "06": {
    code: "06",
    category: "technical",
    type: "soft",
    retryStrategy: "immediate",
    customerAction: "A temporary processing error occurred. We'll retry shortly.",
    description: "Error",
  },
  "91": {
    code: "91",
    category: "technical",
    type: "soft",
    retryStrategy: "immediate",
    customerAction:
      "Your bank's system is temporarily unavailable. We'll retry shortly.",
    description: "Issuer or switch inoperative",
  },
  "96": {
    code: "96",
    category: "technical",
    type: "soft",
    retryStrategy: "immediate",
    customerAction: "A system error occurred. We'll retry shortly.",
    description: "System malfunction",
  },
};

/**
 * Classify a decline code from Nomba's response.
 *
 * @param code - The ISO 8583 response code
 * @returns The classification, or a default "unknown" classification
 */
export function classifyDeclineCode(code: string): DeclineClassification {
  const classification = DECLINE_CODE_MAP[code];

  if (classification) {
    return classification;
  }

  // Default: treat unknown codes as soft declines with exponential backoff
  return {
    code,
    category: "unknown",
    type: "soft",
    retryStrategy: "exponential",
    customerAction:
      "Your payment was declined. We'll retry automatically. If this persists, please update your payment method.",
    description: `Unknown decline code: ${code}`,
  };
}

/**
 * Get all decline codes in the map (useful for documentation/API responses).
 */
export function getAllDeclineCodes(): DeclineClassification[] {
  return Object.values(DECLINE_CODE_MAP);
}
