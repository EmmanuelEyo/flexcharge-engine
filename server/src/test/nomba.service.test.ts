import test from "node:test";
import assert from "node:assert";
import { nombaService } from "../services/nomba.service.js";
import { env } from "../config/environment.js";

const originalClient = (nombaService as any).client;
const originalGetValidToken = (nombaService as any).getValidToken;
const originalIsSandbox = (nombaService as any).isSandbox;

function restoreNombaServiceMocks(): void {
  (nombaService as any).client = originalClient;
  (nombaService as any).getValidToken = originalGetValidToken;
  (nombaService as any).isSandbox = originalIsSandbox;
  nombaService.clearTokenCache();
}

test("Nomba Service Payload Construction", async (t) => {
  await t.test("builds a sandbox checkout request in KOBO", async () => {
    console.log("[NOMBA][TEST] validating checkout order payload");
    nombaService.clearTokenCache();

    const requests: Array<{ path: string; body: any; headers: any }> = [];
    (nombaService as any).client = {
      post: async (path: string, body: any, options: any) => {
        requests.push({ path, body, headers: options.headers });
        return {
          data: {
            data: {
              orderReference: body.order.orderReference,
              checkoutLink: "https://sandbox.example/checkout",
            },
          },
        };
      },
    };
    (nombaService as any).getValidToken = async () => "cached-token";
    (nombaService as any).isSandbox = true;

    try {
      const result = await nombaService.createCheckoutOrder({
        orderReference: "sub_test_001",
        amount: 125000,
        currency: "NGN",
        customerEmail: "customer@example.com",
        callbackUrl: "https://api.example/webhooks/nomba",
        tokenizeCard: true,
      });

      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0]!.path, "/v1/checkout/order");
      assert.strictEqual(requests[0]!.body.order.amount, "1250.00");
      assert.strictEqual(requests[0]!.body.order.accountId, env.NOMBA_SUB_ACCOUNT_ID);
      assert.strictEqual(requests[0]!.body.tokenizeCard, true);
      assert.strictEqual(requests[0]!.headers.Authorization, "Bearer cached-token");
      assert.strictEqual(result.checkoutLink, "https://sandbox.example/checkout");
      assert.strictEqual(result.orderReference, "sub_test_001");
    } finally {
      restoreNombaServiceMocks();
    }
  });

  await t.test("builds a tokenized card charge request in KOBO", async () => {
    console.log("[NOMBA][TEST] validating tokenized charge payload");
    nombaService.clearTokenCache();

    const requests: Array<{ path: string; body: any; headers: any }> = [];
    (nombaService as any).client = {
      post: async (path: string, body: any, options: any) => {
        requests.push({ path, body, headers: options.headers });
        return {
          data: {
            code: "00",
            description: "Success",
            data: {
              status: true,
              message: "success",
            },
          },
        };
      },
    };
    (nombaService as any).getValidToken = async () => "cached-token";
    (nombaService as any).isSandbox = true;

    try {
      const result = await nombaService.chargeTokenizedCard({
        tokenKey: "tok_abc",
        orderReference: "inv_test_001",
        amount: 250000,
        currency: "NGN",
        customerEmail: "customer@example.com",
        customerId: "cust_123",
      });

      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0]!.path, "/v1/checkout/tokenized-card-payment");
      assert.strictEqual(requests[0]!.body.tokenKey, "tok_abc");
      assert.strictEqual(requests[0]!.body.order.amount, "2500.00");
      assert.strictEqual(requests[0]!.body.order.customerId, "cust_123");
      assert.strictEqual(requests[0]!.body.order.accountId, env.NOMBA_SUB_ACCOUNT_ID);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, "success");
    } finally {
      restoreNombaServiceMocks();
    }
  });

  await t.test("builds a sub-account verification request", async () => {
    console.log("[NOMBA][TEST] validating transaction verification payload");
    nombaService.clearTokenCache();

    const requests: Array<{ path: string; params: any; headers: any }> = [];
    (nombaService as any).client = {
      get: async (path: string, options: any) => {
        requests.push({ path, params: options.params, headers: options.headers });
        return {
          data: {
            data: {
              status: "SUCCESS",
              transactionId: "txn_verify_123",
              transactionRef: "trx_ref_123",
              tokenizedCardData: {
                tokenKey: "tok_verify",
                cardLast4: "4242",
                cardBrand: "VISA",
              },
            },
          },
        };
      },
    };
    (nombaService as any).getValidToken = async () => "cached-token";
    (nombaService as any).isSandbox = true;

    try {
      const result = await nombaService.verifyTransaction("order_123");

      assert.strictEqual(requests.length, 1);
      assert.ok(requests[0]!.path.includes("/v1/transactions/accounts/"));
      assert.strictEqual(requests[0]!.params.orderReference, "order_123");
      assert.strictEqual(requests[0]!.headers.Authorization, "Bearer cached-token");
      assert.strictEqual(result.status, "SUCCESS");
      assert.strictEqual(result.tokenizedCardData?.tokenKey, "tok_verify");
    } finally {
      restoreNombaServiceMocks();
    }
  });

  await t.test("builds a list tokenized cards request", async () => {
    nombaService.clearTokenCache();

    const requests: Array<{ path: string; params: any; headers: any }> = [];
    (nombaService as any).client = {
      get: async (path: string, options: any) => {
        requests.push({ path, params: options.params, headers: options.headers });
        return {
          data: {
            code: "00",
            description: "Success",
            data: {
              nextPage: "2",
              tokenizedCardDataList: [
                {
                  tokenKey: "tok_abc",
                  customerEmail: "user@example.com",
                  cardType: "Verve",
                  cardPan: "1234********5678",
                  tokenExpirationDate: "12/26",
                },
              ],
            },
          },
        };
      },
    };
    (nombaService as any).getValidToken = async () => "cached-token";

    try {
      const result = await nombaService.listTokenizedCards({
        customerEmail: "user@example.com",
        page: 0,
      });

      assert.strictEqual(requests.length, 1);
      assert.strictEqual(requests[0]!.path, "/v1/checkout/tokenized-card-data");
      assert.strictEqual(requests[0]!.params.customerEmail, "user@example.com");
      assert.strictEqual(requests[0]!.params.page, 0);
      assert.strictEqual(requests[0]!.headers.Authorization, "Bearer cached-token");
      assert.strictEqual(result.nextPage, "2");
      assert.strictEqual(result.total, 1);
      assert.strictEqual(result.tokenizedCardDataList[0]!.tokenKey, "tok_abc");
    } finally {
      restoreNombaServiceMocks();
    }
  });


});
