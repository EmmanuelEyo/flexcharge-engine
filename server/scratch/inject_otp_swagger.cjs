/**
 * Injects the three OTP card-management paths into swagger.json
 *
 * New paths:
 *   POST /tokenized-cards/user-card/saved-card/auth
 *   POST /tokenized-cards/user-card/auth
 *   POST /tokenized-cards/user-card
 */

const fs   = require("fs");
const path = require("path");

const swaggerPath = path.join(__dirname, "../src/config/swagger.json");
const swagger     = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// ── Shared schema for the OTP action response body ───────────────────────────
const otpActionResponseBody = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: {
      type: "object",
      properties: {
        success:        { type: "boolean", example: true },
        message:        { type: "string",  example: "success" },
        orderReference: { type: "string",  format: "uuid", example: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe" },
        nextStep:       { type: "string",  example: "Submit the OTP the customer received via POST /api/tokenized-cards/user-card" },
      },
    },
  },
};

// ── Common security ───────────────────────────────────────────────────────────
const security = [{ ApiKeyAuth: [] }, { BearerAuth: [] }];

// ── Common responses ─────────────────────────────────────────────────────────
const commonResponses = {
  "400": { description: "Validation error — missing or invalid request body fields" },
  "401": { description: "Missing or invalid authentication token" },
  "429": { description: "Rate limit exceeded" },
  "500": { description: "Internal server error or Nomba API failure" },
  "503": { description: "Nomba integration not configured (missing NOMBA_CLIENT_ID / NOMBA_CLIENT_SECRET)" },
};

// ═════════════════════════════════════════════════════════════════════════════
// PATH 1: POST /tokenized-cards/user-card/saved-card/auth
//   Request OTP to validate user before fetching saved cards
// ═════════════════════════════════════════════════════════════════════════════
swagger.paths["/tokenized-cards/user-card/saved-card/auth"] = {
  post: {
    summary: "Request OTP to validate user before fetching saved cards",
    description: [
      "Triggers Nomba to send an OTP SMS to the customer's registered phone number,",
      "authenticating them **before** their previously saved cards are retrieved.",
      "",
      "**When to call:**",
      "Call this when `GET /api/checkout/orders/{orderReference}` returns `hasSavedCards: true`.",
      "After the OTP is delivered, submit it via `GET /api/tokenized-cards/user/{orderReference}?otp=<otp>`",
      "to retrieve the customer's saved cards.",
      "",
      "**Full flow:**",
      "1. `POST /api/tokenized-cards/user-card/saved-card/auth` ← **this endpoint** — triggers OTP",
      "2. Customer receives OTP via SMS",
      "3. `GET /api/tokenized-cards/user/{orderReference}?otp=<otp>` — returns saved cards",
      "",
      "Proxies to Nomba API: `POST /v1/checkout/user-card/saved-card/auth`",
    ].join("\n"),
    tags: ["Tokenized Cards"],
    security,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["orderReference"],
            properties: {
              orderReference: {
                type: "string",
                format: "uuid",
                description: "The original checkout order reference. Used by Nomba to look up the customer's registered mobile number.",
                example: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
              },
            },
          },
          example: {
            orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
          },
        },
      },
    },
    responses: {
      "200": {
        description: "OTP dispatched successfully — customer will receive an SMS shortly",
        content: {
          "application/json": {
            schema: otpActionResponseBody,
            example: {
              success: true,
              data: {
                success:        true,
                message:        "success",
                orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
                nextStep:       "Submit the OTP the customer received via GET /api/tokenized-cards/user/:orderReference?otp=<otp>",
              },
            },
          },
        },
      },
      ...commonResponses,
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// PATH 2: POST /tokenized-cards/user-card/auth
//   Request OTP before saving a user's card (post-payment)
// ═════════════════════════════════════════════════════════════════════════════
swagger.paths["/tokenized-cards/user-card/auth"] = {
  post: {
    summary: "Request OTP before saving a user's card",
    description: [
      "Triggers Nomba to send an OTP SMS to the customer's registered phone number,",
      "authenticating them **before** their card is saved for future use.",
      "",
      "**When to call:**",
      "After a successful checkout payment **and** the customer has opted to save their card",
      "for future recurring charges. Call this endpoint first to dispatch the OTP, then submit",
      "the OTP via `POST /api/tokenized-cards/user-card` to finalise the card save.",
      "",
      "**Full card-save flow:**",
      "1. Customer completes payment successfully",
      "2. `POST /api/tokenized-cards/user-card/auth` ← **this endpoint** — triggers OTP",
      "3. Customer receives OTP via SMS",
      "4. `POST /api/tokenized-cards/user-card` — submits OTP to tokenize and save the card",
      "",
      "Proxies to Nomba API: `POST /v1/checkout/user-card/auth`",
    ].join("\n"),
    tags: ["Tokenized Cards"],
    security,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["orderReference", "phoneNumber"],
            properties: {
              orderReference: {
                type: "string",
                format: "uuid",
                description: "The original checkout order reference against which the payment was made.",
                example: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
              },
              phoneNumber: {
                type: "string",
                description: "The customer's Nigerian mobile number. Nomba will SMS the OTP to this number. Accepted formats: 08012345678 | +2348012345678.",
                example: "08012345678",
              },
            },
          },
          example: {
            orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
            phoneNumber:    "08012345678",
          },
        },
      },
    },
    responses: {
      "200": {
        description: "OTP dispatched successfully — customer will receive an SMS shortly",
        content: {
          "application/json": {
            schema: otpActionResponseBody,
            example: {
              success: true,
              data: {
                success:        true,
                message:        "success",
                orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
                nextStep:       "Submit the OTP the customer received via POST /api/tokenized-cards/user-card",
              },
            },
          },
        },
      },
      ...commonResponses,
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// PATH 3: POST /tokenized-cards/user-card
//   Submit user OTP — finalise and complete card tokenization
// ═════════════════════════════════════════════════════════════════════════════
swagger.paths["/tokenized-cards/user-card"] = {
  post: {
    summary: "Submit user OTP to complete card tokenization",
    description: [
      "Submits the OTP the customer received on their mobile phone to Nomba.",
      "On success, Nomba tokenizes and stores the card for future recurring charges.",
      "",
      "**This is the FINAL step of the card-save OTP flow:**",
      "1. `POST /api/tokenized-cards/user-card/auth` — triggers OTP",
      "2. Customer receives OTP via SMS",
      "3. `POST /api/tokenized-cards/user-card` ← **this endpoint** — submits OTP, saves card",
      "",
      "After this call succeeds, the card's `tokenKey` will appear in future calls to:",
      "- `GET /api/tokenized-cards` (merchant card list)",
      "- `GET /api/tokenized-cards/user/{orderReference}` (customer saved cards)",
      "",
      "The `tokenKey` can then be used to charge the customer via the tokenized-card-payment endpoint.",
      "",
      "Proxies to Nomba API: `POST /v1/checkout/user-card`",
    ].join("\n"),
    tags: ["Tokenized Cards"],
    security,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["orderReference", "phoneNumber", "otp"],
            properties: {
              orderReference: {
                type: "string",
                format: "uuid",
                description: "The original checkout order reference. Must match the reference used in step 1 (POST /user-card/auth).",
                example: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
              },
              phoneNumber: {
                type: "string",
                description: "The customer's Nigerian mobile number. Must match the number used in step 1 (POST /user-card/auth).",
                example: "08012345678",
              },
              otp: {
                type: "string",
                description: "The one-time code received on the customer's mobile phone. Must be 4–8 numeric digits.",
                example: "1234",
                minLength: 4,
                maxLength: 8,
                pattern: "^\\d{4,8}$",
              },
            },
          },
          example: {
            orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
            phoneNumber:    "08012345678",
            otp:            "1234",
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Card saved successfully — the card has been tokenized and is available for future charges",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    success:        { type: "boolean", example: true },
                    message:        { type: "string",  example: "success" },
                    orderReference: { type: "string",  format: "uuid", example: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe" },
                  },
                },
              },
            },
            example: {
              success: true,
              data: {
                success:        true,
                message:        "success",
                orderReference: "c4307d58-2513-41d8-b7f7-dfecd5f9fdbe",
              },
            },
          },
        },
      },
      ...commonResponses,
    },
  },
};

// ── Write back ────────────────────────────────────────────────────────────────
fs.writeFileSync(swaggerPath, JSON.stringify(swagger, null, 2), "utf8");
console.log("✅  swagger.json updated. New paths added:");
console.log("    POST /tokenized-cards/user-card/saved-card/auth");
console.log("    POST /tokenized-cards/user-card/auth");
console.log("    POST /tokenized-cards/user-card");
console.log(`    Total paths: ${Object.keys(swagger.paths).length}`);
