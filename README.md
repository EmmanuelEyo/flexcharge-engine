# FlexCharge

FlexCharge is a subscription billing and wallet engine built to sit on top of a payment provider while keeping the merchant experience focused on business state, not gateway mechanics.

## Demo Credentials

Use the following seeded credentials to explore the dashboard during judging:

- Email: `admin@acme.com`
- Password: `SecurePassword@12345`

The platform lets a business:

- create and manage plans in the dashboard,
- create customers,
- start subscriptions,
- collect recurring payments,
- recover failed renewals through dunning,
- support wallet balances and auto top-up,
- issue invoices and receipts,
- and move money out through settlement and refunds.

The important design choice is this: merchants do not integrate directly with the payment gateway. They integrate with FlexCharge, and FlexCharge translates payment events into subscription state, wallet balance changes, and ledger entries.

## What Judges Should Look For

This platform is built around a few core ideas:

1. **Invoices are the audit trail.** Every meaningful payment attempt creates or updates an invoice.
2. **Webhooks are the source of truth.** Checkout initiation is not enough; payment success is only finalized after webhook verification.
3. **Fallbacks are first-class.** If an automatic card charge fails, the system can fall back to manual payment. If a direct debit mandate is invalid, it can revert to manual billing. If a wallet auto top-up fails due to OTP or decline, it can produce a manual checkout path instead of dropping the event.
4. **The tenant ledger stays separate from customer billing.** Customer payments are recognized first, then credited into the merchant ledger, and only after that can the merchant withdraw or refund funds.

## Core Platform Flow

### 1. Merchant setup

The merchant logs into the dashboard, creates plans, configures settlement details, and generates API keys.

Plans are defined on the platform itself, so the public API does not expose plan creation. That keeps the integration surface lean and lets the merchant manage product pricing from the dashboard.

### 2. Customer creation

The merchant creates a customer record for the end user. This customer becomes the anchor for subscriptions, saved payment methods, wallet balance, and portal access.

### 3. Subscription creation

When the merchant subscribes a customer to a plan:

- FlexCharge creates a pending subscription.
- It creates a pending invoice for the first charge.
- It generates a payment checkout link.
- The customer completes payment on the hosted checkout page.
- Nomba sends a webhook back to FlexCharge.
- FlexCharge verifies the webhook and activates the subscription.

If the checkout also tokenizes a card, FlexCharge stores that token for future renewals.

### 4. Recurring renewal

When the billing cycle renews, FlexCharge:

- finds subscriptions that are due,
- creates a renewal invoice,
- attempts to collect payment automatically,
- and updates the subscription if the charge succeeds.

If the charge fails, the subscription moves into dunning.

### 5. Dunning and recovery

Dunning is the recovery layer for failed renewals. It is designed to avoid silent churn.

The system can:

- retry the saved card,
- retry a direct debit mandate,
- notify the customer by email,
- generate a manual invoice payment link,
- and eventually mark the subscription `unpaid` if all recovery attempts are exhausted.

This means the platform does not just fail a payment. It classifies the failure, retries intelligently, and gives the customer a way back into good standing.

### 6. Wallet flows

Wallets are handled separately from subscriptions, but they use the same payment backbone.

The wallet can be funded by:

- manual top-up,
- or auto top-up when the balance falls below a trigger amount.

If the top-up succeeds, FlexCharge credits the wallet and the tenant ledger.

If the top-up fails:

- and the gateway says OTP is required, FlexCharge creates a manual checkout flow,
- otherwise it marks the attempt failed and waits for a later action.

### 7. Customer portal self-service

The hosted portal lets customers:

- view their subscription,
- update payment methods,
- set a new default card,
- start or verify a direct debit mandate,
- top up their wallet,
- and cancel future renewals.

That portal is the main fallback path for real-world billing problems.

### 8. Settlement and refunds

Money that has been collected is tracked in the merchant ledger.

From there, the merchant can:

- withdraw to a configured settlement bank account,
- or issue a refund where allowed.

The bank account is verified when it is configured, and withdrawals use the saved settlement details.

## Payment Flows In Detail

### Subscription payment flow

1. Merchant creates a customer.
2. Merchant creates a subscription for an active plan.
3. FlexCharge creates a pending invoice.
4. FlexCharge generates a checkout link.
5. Customer pays on the hosted page.
6. Nomba sends a signed webhook.
7. FlexCharge verifies the signature and the transaction.
8. The invoice is marked paid.
9. The subscription becomes active.
10. The merchant ledger is credited.
11. Tokenized card data, if present, is stored for future renewals.

### Renewal and dunning flow

1. Billing job finds due subscriptions.
2. FlexCharge creates a renewal invoice.
3. It tries the automatic payment path first.
4. If the card or mandate succeeds, the subscription is renewed.
5. If the payment fails, the subscription becomes `past_due`.
6. A dunning attempt is recorded.
7. The customer receives reminder email(s).
8. The system retries according to the dunning strategy.
9. If recovery succeeds, the invoice is paid and the subscription returns to `active`.
10. If recovery fails too many times, the subscription becomes `unpaid`.

### Fallback card flow

If a customer has a saved card:

- that card is used for recurring billing and wallet auto top-up,
- a refreshed card can be saved in the portal,
- and future automatic charges use the latest default payment method.

If the card charge requires user intervention or fails persistently, the platform generates a manual payment path instead of abandoning the renewal.

### Direct debit flow

Direct debit is supported as an automatic payment rail for merchants that prefer bank-account based recurring billing.

The customer:

- enters bank details in the portal,
- receives a mandate setup flow,
- completes the validation transfer,
- and waits for the mandate to become active.

Once active, the mandate can become the default payment method and can be used for:

- renewals,
- dunning retries,
- and wallet auto top-up.

If the mandate is revoked or missing, FlexCharge falls back to manual billing rather than continuing to retry a broken automatic path.

### Manual payment flow

Manual payment is the safety net.

It is used when:

- there is no saved payment method,
- a card charge fails,
- a direct debit mandate is not usable,
- or the gateway requires additional customer action.

FlexCharge responds by creating a manual invoice, generating a checkout link, and notifying the customer. The webhook later reconciles the payment back into the invoice and updates the subscription or wallet state.

### Wallet flow

The wallet flow mirrors subscription billing but updates a wallet balance instead of a subscription period.

Manual wallet top-up:

1. Customer requests a top-up amount in the portal.
2. FlexCharge creates a pending invoice.
3. FlexCharge generates a checkout link.
4. Customer pays.
5. Webhook confirmation marks the invoice paid.
6. The wallet balance is credited.
7. The tenant ledger is credited.

Auto top-up:

1. Wallet balance falls below the configured trigger.
2. The scheduled job checks for recent in-flight top-ups to avoid duplicates.
3. FlexCharge charges the default card or direct debit mandate.
4. If successful, the wallet and ledger are credited.
5. If OTP is required, a manual checkout flow is generated.
6. If the charge fails, the invoice is marked failed and the wallet remains unchanged.

## Edge Cases And Recovery Behavior

FlexCharge is intentionally built to handle messy billing cases:

- Duplicate webhook deliveries do not re-activate an already active subscription.
- Plans that disallow multiple subscriptions block duplicate activation.
- Tokenized cards are stored once and reused safely.
- Direct debit mandates that are no longer valid automatically trigger a manual billing fallback.
- Wallet auto top-up has concurrency protection so duplicate charges do not stack.
- OTP-required flows are converted into manual checkout instead of silently failing.
- Invoices remain the reconciliation layer for every payment event.

## Public API Surface

The public API stays intentionally small.

Merchants primarily use it to:

- create and manage customers,
- create and manage subscriptions,
- inspect invoices,
- manage wallets,
- configure settlement details,
- and request portal sessions.

Plans and ledger configuration are managed in the platform dashboard, not by third-party integration code.

For the full API reference, see the developer docs in the app.


## Running Locally

The project is split into a frontend client and a backend server.

### Backend

```bash
cd server
npm install
npm run dev
```

The API runs on the port defined in the server environment, and the health check is available at:

```text
GET /health
```

### Frontend

```bash
cd client
npm install
npm run dev
```

The dashboard runs on:

```text
http://localhost:3000
```

## Useful Entry Points

- Dashboard: merchant-facing product and billing management
- Hosted customer portal: customer self-service billing recovery
- API docs: the developer documentation page inside the app
- Health check: `/health`

## Why This Platform Matters

FlexCharge is not just a payment wrapper. It is a billing control plane.

It gives merchants:

- a clean integration surface,
- subscription lifecycle control,
- wallet support,
- payment recovery,
- ledger visibility,
- and a self-service portal for customers.

For judges, the most important point is that the platform does not stop at "payment succeeded." It continues through reconciliation, state transitions, fallback handling, and merchant settlement.
