# FlexCharge Engine QA Strategy

## Scope

This strategy is based on the current server codebase under `server/src` and the test run performed locally in the in-memory MongoDB environment.

## System Flow Map

### 1. Tenant onboarding and access

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/api-keys`
- `GET /api/auth/api-keys`
- `DELETE /api/auth/api-keys/:id`
- `PATCH /api/auth/webhook`
- `GET /api/auth/webhook-secret`

### 2. Plan management

- `POST /api/plans`
- `GET /api/plans`
- `GET /api/plans/:id`
- `PATCH /api/plans/:id`
- `DELETE /api/plans/:id`

### 3. Customer management

- `POST /api/customers`
- `GET /api/customers`
- `GET /api/customers/:id`
- `PATCH /api/customers/:id`

### 4. Subscription lifecycle

- `POST /api/subscriptions`
- `GET /api/subscriptions`
- `GET /api/subscriptions/:id`
- `POST /api/subscriptions/:id/cancel`
- States enforced in `Subscription` model:
  - `pending`
  - `trialing`
  - `active`
  - `past_due`
  - `paused`
  - `unpaid`
  - `canceled`

### 5. Billing engine

- `calculateNextBillingDate()`
- `findDueSubscriptions()`
- `processRenewal()`
- `processCancelAtPeriodEnd()`
- Daily billing scan Agenda job

### 6. Smart dunning

- `calculateNextRetryDate()`
- `calculateNextPayday()`
- `processDunningRetry()`
- Dunning retry Agenda job

### 7. Nomba integration

- OAuth token acquisition and refresh
- Checkout order creation with `tokenizeCard: true`
- Tokenized card charge
- Transaction verification
- Nomba webhook ingestion

### 8. Wallet and auto top-up

- `createWallet()`
- `creditWallet()`
- `debitWallet()`
- Low balance detection
- Auto top-up Agenda job

### 9. Webhooks and outbound events

- `queueWebhook()`
- `deliverWebhook()`
- Retry scheduling for failed deliveries

## Risk Areas

### Highest risk

- KOBO integer handling
- Invoice idempotency
- Subscription state transitions
- Cross-tenant isolation
- Nomba sandbox reliability
- Webhook replay handling
- Dunning retry classification

### Medium risk

- Agenda job wiring
- Wallet threshold logic
- Proration math
- Validation and error handling

### Lower risk

- Read-only listing endpoints
- Simple CRUD happy paths
- Static helpers and view models

## Testing Levels

### Unit tests

Use for pure math, state classification, and request-building logic:

- proration calculations
- decline code mapping
- next billing date computation
- next retry date calculation
- Nomba request payload formatting

### Integration tests

Use for model-backed business logic with MongoDB:

- subscription creation
- renewal and dunning flows
- webhook activation
- wallet ledger updates
- tenant isolation

### E2E tests

Use for full request/response flows through Express:

- auth and API key lifecycle
- plan/customer CRUD
- subscription lifecycle
- portal session creation
- webhook receiver behavior

## Nomba Sandbox Notes

- Token issuance is the only Nomba call that has been stable enough for local execution.
- Checkout order creation returned `404` during local sandbox verification, so it should be treated as a high-priority integration risk.
- Tokenized card charge and transaction verification should be exercised with a mix of:
  - real sandbox smoke tests when credentials are available
  - request-payload unit tests with mocked client calls
  - idempotency assertions against invoice and subscription state

## Prioritized Test Cases

### P0

- Register/login tenant
- API key create/list/revoke
- Tenant isolation across plans/customers/subscriptions/invoices/wallets
- Subscription create and activation
- Renewal success and duplicate prevention
- Renewal failure and dunning creation
- Nomba webhook activation and replay protection
- Wallet credit/debit integer accuracy

### P1

- Plan CRUD and soft delete
- Customer CRUD and duplicate protection
- Cancel immediately vs cancel at period end
- Dunning retry scheduling for soft and hard declines
- Token refresh job behavior
- Auto top-up job behavior

### P2

- Portal session generation
- Read-only invoice and subscription listings
- Error shape and validation messages
- Webhook delivery retry backoff

## Execution Baseline

- Existing suite status before adding new coverage: 26 passing tests.
- Observed local risk: checkout order creation to Nomba sandbox surfaced `404` while token issuance succeeded.
- Observed local risk: duplicate index warning on `Subscription.customerId`.

## Recommended Coverage Gaps To Close Next

- Live sandbox smoke tests for checkout and charge once credentials and endpoint behavior are confirmed.
- Agenda job execution tests with a dedicated replica-set MongoDB harness.
- Webhook signature verification if and when receiver signing is implemented.
- More negative-path API tests for validation and permission errors.
