/**
 * Injects POST and DELETE /tokenized-cards paths into swagger.json
 *
 * Nomba API:
 *   POST   /v1/checkout/tokenized-card-data  → Update tokenized card email
 *   DELETE /v1/checkout/tokenized-card-data  → Delete tokenized card
 *
 * These map to FlexCharge routes:
 *   POST   /api/tokenized-cards
 *   DELETE /api/tokenized-cards
 */

const fs   = require("fs");
const path = require("path");

const swaggerPath = path.join(__dirname, "../src/config/swagger.json");
const swagger     = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

// ── Shared reusable pieces ────────────────────────────────────────────────────
const security = [{ ApiKeyAuth: [] }, { BearerAuth: [] }];

const tokenizedCardItemSchema = {
  type: "object",
  properties: {
    tokenKey:            { type: "string", example: "e890bd1a9f0d" },
    customerEmail:       { type: "string", format: "email", example: "email@email.com" },
    cardType:            { type: "string", example: "Verve" },
    cardPan:             { type: "string", example: "234818********7580" },
    tokenExpirationDate: { type: "string", example: "20/20" },
  },
};

const commonResponses = {
  "400": { description: "Validation error — missing or invalid request body fields" },
  "401": { description: "Missing or invalid authentication token" },
  "403": { description: "Forbidden — insufficient permissions for this operation" },
  "404": { description: "tokenKey not found in Nomba's vault" },
  "429": { description: "Rate limit exceeded" },
  "500": { description: "Internal server error or Nomba API failure" },
  "503": { description: "Nomba integration not configured (missing NOMBA_CLIENT_ID / NOMBA_CLIENT_SECRET)" },
};

// ═════════════════════════════════════════════════════════════════════════════
// Merge POST and DELETE into the existing /tokenized-cards path object.
// The GET handler is already registered there, so we add to it rather than
// overwriting the whole object.
// ═════════════════════════════════════════════════════════════════════════════

if (!swagger.paths["/tokenized-cards"]) {
  swagger.paths["/tokenized-cards"] = {};
}

// ── POST /tokenized-cards — Update tokenized card email ──────────────────────
swagger.paths["/tokenized-cards"].post = {
  summary: "Update tokenized card data",
  description: [
    "Updates the email address associated with a specific tokenized card token.",
    "",
    "Nomba validates that `currentEmailAddress` **exactly matches** the email on",
    "record for `tokenKey` before applying the update. If there is a mismatch,",
    "Nomba will return a 400 error.",
    "",
    "**Use cases:**",
    "- Customer updates their email address in the merchant's app",
    "- Merging duplicate customer accounts under a new email",
    "- Correcting a typo in the customer's original email",
    "",
    "Proxies to Nomba API: `POST /v1/checkout/tokenized-card-data`",
  ].join("\n"),
  tags: ["Tokenized Cards"],
  security,
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["tokenKey", "currentEmailAddress", "newEmailAddress"],
          properties: {
            tokenKey: {
              type: "string",
              description: "The token key returned by Nomba when the card was tokenized. Available from GET /api/tokenized-cards.",
              example: "5844858382",
            },
            currentEmailAddress: {
              type: "string",
              format: "email",
              description: "Email address currently associated with this tokenKey in Nomba's vault. Must match exactly — Nomba validates this before applying the update.",
              example: "email@email.com",
            },
            newEmailAddress: {
              type: "string",
              format: "email",
              description: "New email address to associate with this tokenKey going forward.",
              example: "newemail@email.com",
            },
          },
        },
        example: {
          tokenKey:            "5844858382",
          currentEmailAddress: "email@email.com",
          newEmailAddress:     "newemail@email.com",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Tokenized card updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  status: {
                    type: "boolean",
                    description: "true when the update was applied successfully",
                    example: true,
                  },
                  message: {
                    type: "string",
                    description: "The new email address now associated with the token",
                    example: "newemail@email.com",
                  },
                  tokenizedCardData: {
                    type: "array",
                    description: "The updated card records for this token",
                    items: tokenizedCardItemSchema,
                  },
                  total: {
                    type: "integer",
                    description: "Number of card records returned",
                    example: 1,
                  },
                },
              },
            },
          },
          example: {
            success: true,
            data: {
              status:  true,
              message: "newemail@email.com",
              total:   1,
              tokenizedCardData: [
                {
                  tokenKey:            "e890bd1a9f0d",
                  customerEmail:       "newemail@email.com",
                  cardType:            "Verve",
                  cardPan:             "234818********7580",
                  tokenExpirationDate: "20/20",
                },
              ],
            },
          },
        },
      },
    },
    ...commonResponses,
  },
};

// ── DELETE /tokenized-cards — Permanently delete a tokenized card ─────────────
swagger.paths["/tokenized-cards"].delete = {
  summary: "Delete tokenized card data",
  description: [
    "Permanently removes a tokenized card from Nomba's vault.",
    "",
    "> **⚠️ IRREVERSIBLE**: Once deleted, the `tokenKey` is immediately invalidated",
    "> and can no longer be used for recurring charges. The customer must go through",
    "> the full card-save OTP flow again to re-register their card.",
    "",
    "**Use cases:**",
    "- Customer explicitly requests card removal (GDPR / NDPR compliance)",
    "- Merchant cleaning up expired or invalid token keys",
    "- Regulatory or compliance-mandated PII purging",
    "",
    "**Note:** Although this is a DELETE request, Nomba requires a JSON body",
    "containing the `tokenKey`. Pass it in the request body as shown.",
    "",
    "Proxies to Nomba API: `DELETE /v1/checkout/tokenized-card-data`",
  ].join("\n"),
  tags: ["Tokenized Cards"],
  security,
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["tokenKey"],
          properties: {
            tokenKey: {
              type: "string",
              description: "The token key of the card to permanently delete. Once deleted this tokenKey is invalidated and cannot be recovered.",
              example: "5844858382",
            },
          },
        },
        example: {
          tokenKey: "5844858382",
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Tokenized card deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  status: {
                    type: "boolean",
                    description: "true when the card was deleted successfully",
                    example: true,
                  },
                  message: {
                    type: "string",
                    description: "Human-readable confirmation",
                    example: "success",
                  },
                  tokenKey: {
                    type: "string",
                    description: "The tokenKey that was deleted",
                    example: "5844858382",
                  },
                },
              },
            },
          },
          example: {
            success: true,
            data: {
              status:   true,
              message:  "success",
              tokenKey: "5844858382",
            },
          },
        },
      },
    },
    ...commonResponses,
  },
};

// ── Write back ────────────────────────────────────────────────────────────────
fs.writeFileSync(swaggerPath, JSON.stringify(swagger, null, 2), "utf8");

const allPaths = Object.keys(swagger.paths);
console.log("✅  swagger.json updated. Methods on /tokenized-cards:");
console.log("    " + Object.keys(swagger.paths["/tokenized-cards"]).map(m => m.toUpperCase()).join(", "));
console.log(`    Total paths in spec: ${allPaths.length}`);
