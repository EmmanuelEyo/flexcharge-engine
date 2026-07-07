"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import "swagger-ui-react/swagger-ui.css";
import swaggerDoc from "./swagger.json";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="p-8 text-center text-slate-500">Loading API reference...</p>
  ),
});

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface EndpointDoc {
  method: Method;
  route: string;
  purpose: string;
  inputs: string;
  why: string;
  note?: string;
}

const authCards = [
  {
    title: "Developer API",
    value: "x-api-key: <tenant_api_key>",
    note: "Use this for all server-to-server requests.",
  },
  {
    title: "Customer Portal",
    value: "Authorization: Bearer <portal_session_token>",
    note: "Use this only inside the hosted portal.",
  },
  {
    title: "Webhook Verification",
    value: "x-flexcharge-signature + x-flexcharge-timestamp",
    note: "Verify every webhook before processing it.",
  },
];

const workflowSteps = [
  {
    title: "Set up products in the platform UI",
    body: "Create plans and configure ledger settings in the dashboard. The API is only for runtime integration.",
  },
  {
    title: "Fetch the active plan catalog",
    body: "Call GET /api/plans so your backend can discover the tenant's available plans.",
  },
  {
    title: "Create or update the customer",
    body: "Provision the billing identity with POST /api/customers using the customer's email as the unique key.",
  },
  {
    title: "Create the subscription",
    body: "Call POST /api/subscriptions to create a pending subscription and receive a checkout link.",
  },
  {
    title: "Let FlexCharge handle payment state",
    body: "Do not call payment gateways directly. Wait for signed webhooks to confirm activation, renewal, pause, cancellation, or failure.",
  },
  {
    title: "Use wallets for credit-based billing",
    body: "Create a wallet, check its balance, then top up or deduct credits as usage changes.",
  },
  {
    title: "Generate a hosted portal link when needed",
    body: "Use POST /api/portal/sessions for customer self-service and account management.",
  },
];

const endpointGroups: Array<{ title: string; items: EndpointDoc[] }> = [
  {
    title: "Plans",
    items: [
      {
        method: "GET",
        route: "/api/plans",
        purpose: "List the tenant's plans.",
        inputs: "Optional query: active=true|false",
        why: "Developers need to discover the plans created in the dashboard before subscribing customers.",
      },
      {
        method: "GET",
        route: "/api/plans/public/:id",
        purpose: "Fetch one public plan for hosted checkout.",
        inputs: "Path: id (plan ID or slug)",
        why: "Useful for hosted purchase pages when you want FlexCharge to resolve branding and pricing for you.",
        note: "Optional helper. The core integration flow can rely on authenticated plan discovery.",
      },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        method: "POST",
        route: "/api/customers",
        purpose: "Create a customer record.",
        inputs: "email, name?, phone?, metadata?",
        why: "Every billing action needs a customer anchor inside the tenant.",
      },
      {
        method: "GET",
        route: "/api/customers",
        purpose: "List customers.",
        inputs: "Optional query: page, limit, email",
        why: "Useful for reconciliation, support tooling, and duplicate prevention.",
      },
      {
        method: "GET",
        route: "/api/customers/:id",
        purpose: "Fetch one customer.",
        inputs: "Path: id",
        why: "Needed when your app must read the customer profile or confirm ownership.",
      },
      {
        method: "PATCH",
        route: "/api/customers/:id",
        purpose: "Update customer details.",
        inputs: "Path: id; body: name?, phone?, metadata?",
        why: "Lets the integration keep billing identity details in sync without changing the unique email key.",
      },
    ],
  },
  {
    title: "Subscriptions",
    items: [
      {
        method: "POST",
        route: "/api/subscriptions",
        purpose: "Create a subscription and checkout link.",
        inputs: "customerId, planId, metadata?, returnUrl?",
        why: "This is the core subscription creation endpoint.",
      },
      {
        method: "GET",
        route: "/api/subscriptions",
        purpose: "List subscriptions.",
        inputs: "Optional query: status, customerId",
        why: "Needed for lifecycle reconciliation and support.",
      },
      {
        method: "GET",
        route: "/api/subscriptions/:id",
        purpose: "Fetch one subscription.",
        inputs: "Path: id",
        why: "Required to inspect current state after webhook events.",
      },
      {
        method: "POST",
        route: "/api/subscriptions/:id/cancel",
        purpose: "Cancel immediately or at period end.",
        inputs: "Path: id; body: cancelAtPeriodEnd, cancellationReason?",
        why: "Cancellation is a required lifecycle action for any subscription system.",
      },
      {
        method: "POST",
        route: "/api/subscriptions/:id/change-plan",
        purpose: "Upgrade or downgrade a subscription synchronously.",
        inputs: "Path: id; body: newPlanId, changeDate?",
        why: "Needed for proration and plan migration flows. Upgrades require a saved card.",
      },
      {
        method: "POST",
        route: "/api/subscriptions/:id/change-plan-checkout",
        purpose: "Generate an async checkout link for a plan upgrade.",
        inputs: "Path: id; body: newPlanId",
        why: "Allows developers to send users to a checkout flow to pay for the prorated upgrade difference.",
      },
      {
        method: "POST",
        route: "/api/subscriptions/:id/simulate-change",
        purpose: "Simulate a plan change (Proration dry-run).",
        inputs: "Path: id; body: newPlanId",
        why: "Allows the client app to preview the cost differences and proration details before committing to a plan change.",
      },
    ],
  },
  {
    title: "Wallets",
    items: [
      {
        method: "POST",
        route: "/api/wallets",
        purpose: "Create a wallet for a customer.",
        inputs: "customerId, subscriptionId?",
        why: "Required for credit-based billing and usage consumption.",
      },
      {
        method: "GET",
        route: "/api/wallets",
        purpose: "List wallets.",
        inputs: "Optional query: customerId, walletGroupId",
        why: "Useful for finding the customer's active wallet.",
      },
      {
        method: "GET",
        route: "/api/wallets/:id",
        purpose: "Read a wallet balance and settings.",
        inputs: "Path: id",
        why: "The simplest way to display or reconcile the current credit balance.",
      },
      {
        method: "POST",
        route: "/api/wallets/:id/top-up",
        purpose: "Add credits to a wallet.",
        inputs: "Path: id; body: amount, description, referenceId?",
        why: "Required for manual top-ups and wallet funding flows.",
      },
      {
        method: "POST",
        route: "/api/wallets/:id/deduct",
        purpose: "Deduct credits from a wallet.",
        inputs: "Path: id; body: amount, description, referenceId?",
        why: "Required for atomic usage billing.",
      },
      {
        method: "GET",
        route: "/api/wallets/:id/transactions",
        purpose: "List wallet transactions.",
        inputs: "Path: id",
        why: "Needed for auditability and reconciliation.",
      },
    ],
  },
  {
    title: "Portal",
    items: [
      {
        method: "POST",
        route: "/api/portal/sessions",
        purpose: "Create a temporary hosted-portal session.",
        inputs: "customerId",
        why: "Generates the secure customer portal entry point without exposing long-lived credentials.",
        note: "The backend sends the link to the customer and returns an acknowledgement, not the raw portal token.",
      },
    ],
  },
];

const webhookEvents = [
  "subscription.created",
  "subscription.renewed",
  "subscription.updated",
  "subscription.payment_failed",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
  "wallet.credited",
  "wallet.debited",
  "wallet.low_balance",
];

function MethodBadge({ method }: { method: Method }) {
  const classes: Record<Method, string> = {
    GET: "bg-sky-50 text-sky-700 border-sky-100",
    POST: "bg-emerald-50 text-emerald-700 border-emerald-100",
    PATCH: "bg-amber-50 text-amber-700 border-amber-100",
    DELETE: "bg-rose-50 text-rose-700 border-rose-100",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${classes[method]}`}>
      {method}
    </span>
  );
}

function DocSection({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <span className="material-symbols-outlined text-[#4F46E5] text-[20px] leading-none">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function SidebarLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const targetId = href.replace("#", "");
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-indigo-600"
    >
      {label}
      <span className="material-symbols-outlined text-[16px] text-slate-400">arrow_forward</span>
    </a>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 animate-in fade-in duration-500">
      <aside className="hidden w-72 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white md:block">
        <div className="p-5">
          <Link
            href="/dashboard/developers"
            className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Config
          </Link>

          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                Getting Started
              </h3>
              <div className="space-y-1">
                <SidebarLink href="#overview" label="Overview" />
                <SidebarLink href="#auth" label="Authentication" />
                <SidebarLink href="#workflow" label="Integration Flow" />
                <SidebarLink href="#webhooks" label="Webhooks" />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                API Reference
              </h3>
              <div className="space-y-1">
                <SidebarLink href="#plans" label="Plans" />
                <SidebarLink href="#customers" label="Customers" />
                <SidebarLink href="#subscriptions" label="Subscriptions" />
                <SidebarLink href="#wallets" label="Wallets" />
                <SidebarLink href="#portal" label="Portal Session" />
                <SidebarLink href="#interactive" label="Interactive Swagger" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white p-8 scroll-smooth lg:p-12">
        <div className="mx-auto max-w-6xl space-y-10 pb-24">
          <section id="overview" className="space-y-4 scroll-mt-8">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Public Billing API
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                FlexCharge Developer API
              </h1>
              <p className="max-w-4xl text-lg leading-relaxed text-slate-600">
                This page documents the lean, public-facing API surface a third-party backend needs to integrate FlexCharge into its own application. Plan creation and ledger setup happen in the platform UI, while runtime billing operations happen over the API.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {authCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {card.title}
                  </div>
                  <div className="mt-2 break-all font-mono text-sm text-slate-900">
                    {card.value}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {card.note}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              Keep the public docs focused on tenant-scoped runtime actions. Do not expose internal auth endpoints or gateway-specific payment calls.
            </div>
          </section>

          <DocSection id="auth" title="Authentication" icon="security">
            <div className="space-y-4">
              <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
                Tenant API keys are used for server-to-server calls. The backend currently expects the raw API key in the <span className="font-semibold text-slate-900">x-api-key</span> header. Customer portal sessions use a short-lived portal JWT in the <span className="font-semibold text-slate-900">Authorization: Bearer</span> header.
              </p>
              <div className="rounded-xl bg-slate-950 p-5 text-sm text-slate-200 shadow-inner">
                <pre className="overflow-x-auto font-mono">
{`curl http://localhost:7000/api/customers \\
  -H "x-api-key: flx_live_xxxxxxxxxxxxxxxxx"`}
                </pre>
              </div>
            </div>
          </DocSection>

          <DocSection id="workflow" title="Integration Flow" icon="route">
            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </DocSection>

          <div className="space-y-6">
            {endpointGroups.map((group) => (
              <DocSection
                key={group.title}
                id={group.title.toLowerCase()}
                title={group.title}
                icon={group.title === "Portal" ? "call_to_action" : "api"}
              >
                <div className="space-y-4">
                  {group.items.map((endpoint) => (
                    <article key={`${endpoint.method}-${endpoint.route}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <MethodBadge method={endpoint.method} />
                            <code className="text-sm font-semibold text-slate-900">{endpoint.route}</code>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700">{endpoint.purpose}</p>
                        </div>
                        <div className="max-w-xl rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Required Inputs
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700">{endpoint.inputs}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Why it matters
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700">{endpoint.why}</p>
                        </div>
                        {endpoint.note ? (
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                              Note
                            </div>
                            <p className="text-sm leading-relaxed text-indigo-900">{endpoint.note}</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-500">
                            This endpoint is part of the minimum public contract for the billing integration flow.
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </DocSection>
            ))}
          </div>

          <DocSection id="webhooks" title="Webhooks" icon="webhook">
            <div className="space-y-4">
              <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
                Webhooks are how the integrating backend learns about subscription and wallet state changes. Treat them as the source of truth rather than polling the payment gateway.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {webhookEvents.map((event) => (
                  <div key={event} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                    {event}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Verification headers
                </div>
                <code className="block rounded-lg bg-slate-950 px-4 py-3 font-mono text-xs text-slate-100 overflow-x-auto">
                  x-flexcharge-signature, x-flexcharge-timestamp, x-flexcharge-event
                </code>
              </div>
            </div>
          </DocSection>

          <DocSection id="interactive" title="Interactive Swagger" icon="menu_book">
            <div className="space-y-4">
              <p className="max-w-4xl text-sm leading-relaxed text-slate-600">
                The interactive reference below mirrors the same lean public contract documented above. It intentionally omits internal auth, ledger admin, and gateway-specific endpoints.
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <SwaggerUI spec={swaggerDoc} />
              </div>
            </div>
          </DocSection>
        </div>
      </main>
    </div>
  );
}
