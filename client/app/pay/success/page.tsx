"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle, Mail, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

export default function CheckoutSuccessPage() {
  const [mounted, setMounted] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Portal link state
  const [portalState, setPortalState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    // Nomba appends orderRef to the callback URL on redirect
    setOrderRef(params.get("orderRef") ?? params.get("order_ref") ?? null);
    setSubscriptionId(params.get("subscriptionId") ?? null);
  }, []);

  const handleSendPortalLink = useCallback(async () => {
    if (portalState === "loading" || portalState === "sent") return;
    setPortalState("loading");
    setPortalError("");

    try {
      const body: Record<string, string> = {};
      if (orderRef) body.orderRef = orderRef;
      else if (subscriptionId) body.subscriptionId = subscriptionId;

      const res = await fetch(`${API_BASE_URL}/subscriptions/request-portal-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }
      setPortalState("sent");
    } catch {
      setPortalState("error");
      setPortalError("Something went wrong. Please try again.");
    }
  }, [orderRef, subscriptionId, portalState]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center">
        {/* Success icon */}
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 mb-4">
          Thank you for subscribing. Your account has been provisioned and your
          invoice has been sent to your email.
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 text-sm text-blue-800 text-left">
          <p className="font-semibold mb-1">Paid via Bank Transfer?</p>
          <p>
            If you completed your payment via bank transfer, your subscription
            will not auto-renew. You will receive an invoice via email next
            month to renew manually.
          </p>
        </div>

        {/* Portal link section */}
        <div className="space-y-3">
          {portalState === "sent" ? (
            /* ── Confirmation state ── */
            <div className="flex flex-col items-center gap-3 py-4 px-6 rounded-xl bg-indigo-50 border border-indigo-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-indigo-900 text-sm">Portal link sent!</p>
                <p className="text-indigo-700 text-xs mt-0.5">
                  Check your inbox for your Customer Portal access link.
                </p>
              </div>
            </div>
          ) : (
            /* ── CTA button ── */
            <button
              id="send-portal-link-btn"
              onClick={handleSendPortalLink}
              disabled={portalState === "loading"}
              className="block w-full py-3.5 px-4 rounded-lg bg-[#4F46E5] hover:bg-[#4338ca] text-white font-semibold transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {portalState === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending link…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Access Customer Portal
                </>
              )}
            </button>
          )}

          {portalState === "error" && (
            <p className="text-sm text-red-500">{portalError}</p>
          )}

          <p className="text-sm text-slate-400">Powered by FlexCharge</p>
        </div>
      </div>
    </div>
  );
}
