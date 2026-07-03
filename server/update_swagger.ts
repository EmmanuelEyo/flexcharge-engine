import fs from "fs";
import path from "path";

const swaggerPath = path.join(process.cwd(), "src/config/swagger.json");
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, "utf-8"));

swaggerData.paths["/api/analytics/current"] = {
  get: {
    tags: ["Analytics"],
    summary: "Get current top-line analytics metrics",
    description: "Returns MRR, ARR, Active Subscribers, ARPU, and Churn Rate for the authenticated tenant.",
    security: [{ ApiKeyAuth: [] }, { bearerAuth: [] }],
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    mrr: { type: "number", description: "MRR in Kobo" },
                    arr: { type: "number", description: "ARR in Kobo" },
                    activeSubscribers: { type: "number" },
                    arpu: { type: "number", description: "ARPU in Kobo" },
                    churnRate: { type: "number", description: "Churn percentage" },
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

swaggerData.paths["/api/analytics/historical"] = {
  get: {
    tags: ["Analytics"],
    summary: "Get historical analytics snapshots",
    description: "Returns an array of daily analytics snapshots for charting.",
    security: [{ ApiKeyAuth: [] }, { bearerAuth: [] }],
    parameters: [
      {
        name: "days",
        in: "query",
        description: "Number of past days to retrieve (default: 30, max: 365)",
        required: false,
        schema: {
          type: "integer"
        }
      }
    ],
    responses: {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string" },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", format: "date-time" },
                      mrr: { type: "number" },
                      arr: { type: "number" },
                      activeSubscribers: { type: "number" },
                      churnRate: { type: "number" },
                      arpu: { type: "number" },
                      dailyRevenue: { type: "number" },
                      dailyFailedRevenue: { type: "number" },
                      dailyWalletConsumption: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

if (!swaggerData.tags) swaggerData.tags = [];
if (!swaggerData.tags.find((t: any) => t.name === "Analytics")) {
  swaggerData.tags.push({ name: "Analytics", description: "Tenant metrics and analytics" });
}

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2), "utf-8");
console.log("Swagger updated successfully.");
