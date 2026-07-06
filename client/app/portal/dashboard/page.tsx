"use client";

import React, { useEffect, useState, Suspense } from "react";
import portalApi from "@/lib/portalApi";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useSearchParams } from "next/navigation";
import { usePortal } from "@/context/PortalContext";

interface Subscription {
  _id: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planId: {
    name: string;
    amount: number;
    interval: string;
    currency: string;
  };
}

interface Invoice {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Wallet {
  _id: string;
  balance: number;
  currency: string;
  autoTopUp: boolean;
  autoTopUpAmount: number;
  autoTopUpTrigger: number;
  walletGroupId?: {
    minAutoTopUpAmount?: number;
    maxAutoTopUpAmount?: number;
    minAutoTopUpTrigger?: number;
    maxAutoTopUpTrigger?: number;
  };
}

interface PaymentMethod {
  methodType: string;
  isDefault: boolean;
  bankCode?: string;
  accountNumberMasked?: string;
  mandateId?: string;
  mandateStatus?: string;
}

function PortalDashboardContent() {
  const searchParams = useSearchParams();
  const { customer, loading: customerLoading } = usePortal();
  
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showTopupBanner, setShowTopupBanner] = useState(false);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Mandate modal state
  const [showPaymentSelectorModal, setShowPaymentSelectorModal] = useState(false);
  const [showMandateModal, setShowMandateModal] = useState(false);
  const [mandateLoading, setMandateLoading] = useState(false);
  const [mandateForm, setMandateForm] = useState({ bankCode: "", accountNumber: "", phoneNumber: "", accountName: "", address: "" });
  const [mandatePending, setMandatePending] = useState<any>(null);

  
  // Wallet modals state
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState("");

  const [settingsLoading, setSettingsLoading] = useState(false);

  interface ToastState {
    message: string;
    type: "success" | "error";
  }
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    async function loadData() {
      try {
        const [subRes, invRes, walletRes, pmRes] = await Promise.all([
          portalApi.get("/portal/subscription").catch(() => null),
          portalApi.get("/portal/invoices").catch(() => null),
          portalApi.get("/portal/wallet").catch(() => null),
          portalApi.get("/portal/payment-methods").catch(() => null),
        ]);

        if (subRes?.data?.data) setSubscription(subRes.data.data);
        if (invRes?.data?.data) setInvoices(invRes.data.data);
        if (walletRes?.data?.data) setWallet(walletRes.data.data);
        if (pmRes?.data?.data?.paymentMethods) setPaymentMethods(pmRes.data.data.paymentMethods);
        
        if (searchParams.get("card_update") === "success") {
          setShowSuccessBanner(true);
        }
        if (searchParams.get("topup") === "success") {
          setShowTopupBanner(true);
        }
      } catch (err) {
        console.error("Failed to load portal data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [searchParams]);

  const formatCurrency = (amount: number, currency: string = "NGN") => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const handleUpdatePayment = async () => {
    setActionLoading(true);
    try {
      const res = await portalApi.post("/portal/update-payment-method");
      if (res.data.data.checkoutLink) {
        window.location.href = res.data.data.checkoutLink;
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to initiate payment update. Please try again.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMandateLoading(true);
    try {
      const res = await portalApi.post("/portal/payment-methods/mandate/initiate", mandateForm);
      setMandatePending(res.data.data);
      // Refresh payment methods
      const pmRes = await portalApi.get("/portal/payment-methods");
      setPaymentMethods(pmRes.data.data.paymentMethods);
      setToast({ message: "Mandate initiated. Please follow validation instructions.", type: "success" });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to initiate mandate.", type: "error" });
    } finally {
      setMandateLoading(false);
    }
  };

  const handleVerifyMandate = async (mandateId: string) => {
    setMandateLoading(true);
    try {
      const res = await portalApi.post("/portal/payment-methods/mandate/verify", { mandateId, setAsDefault: true });
      if (res.data.data.isUsable) {
        setToast({ message: "Mandate verified and activated!", type: "success" });
        setMandatePending(null);
        setShowMandateModal(false);
      } else {
        setToast({ message: res.data.data.message || "Mandate not yet active.", type: "error" });
      }
      
      // Refresh payment methods and subscription
      const [pmRes, subRes] = await Promise.all([
        portalApi.get("/portal/payment-methods"),
        portalApi.get("/portal/subscription")
      ]);
      setPaymentMethods(pmRes.data.data.paymentMethods);
      setSubscription(subRes.data.data);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to verify mandate.", type: "error" });
    } finally {
      setMandateLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    try {
      const res = await portalApi.post("/portal/cancel");
      setSubscription(res.data.data);
      setShowCancelModal(false);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to cancel subscription.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupAmount || isNaN(Number(topupAmount)) || Number(topupAmount) <= 0) {
      setTopupError("Please enter a valid amount greater than 0");
      return;
    }

    setTopupLoading(true);
    setTopupError("");
    try {
      // Amount in kobo
      const amountKobo = Math.round(Number(topupAmount) * 100);
      const res = await portalApi.post("/portal/wallet/topup", { amount: amountKobo });
      if (res.data.data.checkoutLink) {
        window.location.href = res.data.data.checkoutLink;
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      setTopupError(err.response?.data?.message || "Failed to initiate top-up");
      setTopupLoading(false);
    }
  };

  const handleToggleAutoTopup = async () => {
    if (!wallet) return;
    setSettingsLoading(true);
    try {
      const newStatus = !wallet.autoTopUp;
      // If turning on, we might want to default some values if they are 0
      const payload = { 
        autoTopUp: newStatus,
        ...(newStatus && wallet.autoTopUpAmount === 0 ? { autoTopUpAmount: 500000, autoTopUpTrigger: 100000 } : {})
      };
      const res = await portalApi.post("/portal/wallet/settings", payload);
      setWallet(res.data.data);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update settings.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveAutoTopupSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wallet) return;
    setSettingsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("autoTopUpAmount"));
    const trigger = Number(formData.get("autoTopUpTrigger"));

    try {
      const res = await portalApi.post("/portal/wallet/settings", {
        autoTopUpAmount: amount * 100, // to kobo
        autoTopUpTrigger: trigger * 100, // to kobo
      });
      setWallet(res.data.data);
      setToast({ message: "Settings saved successfully.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to save settings.", type: "error" });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handlePrintReceipt = (inv: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>Receipt - ${inv._id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 600px; margin: 0 auto; line-height: 1.5; }
            h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 32px; }
            .meta p { margin: 4px 0; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 16px 0; font-size: 15px; }
            .row:last-child { border-bottom: none; }
            .total { font-weight: 600; font-size: 18px; margin-top: 16px; border-top: 2px solid #e2e8f0; border-bottom: none; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
            .badge-paid { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .badge-pending { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
            .badge-refunded { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .badge-failed { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
            .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Receipt from ${customer?.tenantId?.name || "FlexCharge"}</h1>
          <div class="meta">
            <p>Invoice ID: ${inv._id}</p>
            <p>Date: ${new Date(inv.createdAt).toLocaleDateString()}</p>
            <p>Billed to: ${customer?.name} (${customer?.email})</p>
          </div>
          
          <div class="row">
            <span style="color: #64748b">Status</span>
            <span class="badge badge-${inv.status}">${inv.status}</span>
          </div>
          
          <div class="row total">
            <span>Total Amount</span>
            <span>${formatCurrency(inv.amount)}</span>
          </div>
          
          <div class="footer">
            <p>Powered by FlexCharge</p>
          </div>
          
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading || customerLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-medium text-slate-900">Session expired or invalid</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {showSuccessBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-950">Payment Method Updated</h3>
            <p className="text-sm text-emerald-800 mt-0.5">
              Your card details have been securely updated. Future renewals will use this new payment method.
            </p>
          </div>
          <button onClick={() => setShowSuccessBanner(false)} className="text-emerald-500 hover:text-emerald-700 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {showTopupBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-emerald-600">check_circle</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-950">Top-Up Successful</h3>
            <p className="text-sm text-emerald-800 mt-0.5">
              Your wallet has been successfully credited.
            </p>
          </div>
          <button onClick={() => setShowTopupBanner(false)} className="text-emerald-500 hover:text-emerald-700 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Hello, {customer.name}
        </h1>
        <p className="text-slate-500 text-lg">
          Manage your subscription and billing details here.
        </p>
      </div>

      {/* Subscription Card */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden z-0">
        {/* Subtle decorative background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-full opacity-50 blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
            <div>
              <h2 className="text-sm font-semibold text-indigo-600 tracking-wide uppercase mb-1">
                Current Plan
              </h2>
              {subscription ? (
                <>
                  <h3 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    {subscription.planId.name}
                    {subscription.cancelAtPeriodEnd ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        Canceling
                      </span>
                    ) : subscription.status === "active" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200 capitalize">
                        {subscription.status}
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-500 mt-2 text-base">
                    {formatCurrency(subscription.planId.amount, subscription.planId.currency)} / {subscription.planId.interval}
                  </p>
                </>
              ) : (
                <h3 className="text-2xl font-semibold text-slate-900">No active plan</h3>
              )}
            </div>

            {subscription && (
              <div className="text-left sm:text-right">
                <p className="text-sm font-medium text-slate-500 mb-1">
                  {subscription.cancelAtPeriodEnd ? "Access ends on" : "Next billing date"}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            {subscription && !subscription.cancelAtPeriodEnd && (
              <Button
                variant="secondary"
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent hover:border-red-200"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Payment Methods Card */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden z-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Payment Methods
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your cards and bank accounts for automatic billing.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setShowPaymentSelectorModal(true);
            }}
            className="flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Payment Method
          </Button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No saved payment methods.
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((pm, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    pm.methodType === "card" ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                  }`}>
                    <span className="material-symbols-outlined">
                      {pm.methodType === "card" ? "credit_card" : "account_balance"}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                      {pm.methodType === "card" ? "Credit Card" : "Direct Debit"}
                      {pm.isDefault && (
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                          Default
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-slate-500 font-medium">
                      {pm.methodType === "card" 
                        ? `•••• ${pm.accountNumberMasked || "****"}`
                        : `${pm.bankCode} •••• ${pm.accountNumberMasked?.slice(-4) || "****"}`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {pm.mandateStatus && pm.mandateStatus !== "ACTIVE" && (
                    <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md border border-amber-200 uppercase flex items-center gap-1">
                      {pm.mandateStatus}
                    </span>
                  )}
                  {pm.methodType === "direct_debit" && pm.mandateStatus !== "ACTIVE" && (
                    <Button 
                      variant="primary" 
                      onClick={() => handleVerifyMandate(pm.mandateId!)}
                      disabled={mandateLoading}
                      className="text-xs py-1.5 px-3"
                    >
                      {mandateLoading ? "Verifying..." : "Verify Status"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Wallet Balance Card (Glassmorphism & Less but Better) */}
      {wallet && (
        <section className="backdrop-blur-md bg-white/30 border border-white/40 shadow-sm rounded-2xl p-6 sm:p-8 relative overflow-hidden transition-all">
          {/* Subtle color splash for the wallet */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-full opacity-40 blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <h2 className="text-sm font-semibold text-emerald-600 tracking-wide uppercase mb-1">
                  Credit Wallet
                </h2>
                <h3 className="text-[40px] leading-[1.2] font-bold text-slate-900">
                  {formatCurrency(wallet.balance, wallet.currency)}
                </h3>
              </div>

              <div className="text-left sm:text-right">
                <Button
                  variant="primary"
                  onClick={() => setShowTopupModal(true)}
                  className="bg-slate-900 text-white hover:bg-slate-800 border-transparent shadow-sm"
                >
                  Add Funds
                </Button>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">Auto Top-Up</h4>
                  <p className="text-sm text-slate-500">Automatically add funds when your balance runs low.</p>
                </div>
                
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleAutoTopup}
                  disabled={settingsLoading}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                    wallet.autoTopUp ? 'bg-emerald-500' : 'bg-slate-200'
                  } ${settingsLoading ? 'opacity-50' : ''}`}
                  role="switch"
                  aria-checked={wallet.autoTopUp}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      wallet.autoTopUp ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Reveal Auto Top-Up Settings with animation if enabled */}
              <div className={`grid transition-all duration-300 ease-out ${wallet.autoTopUp ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <form onSubmit={handleSaveAutoTopupSettings} className="bg-white/50 rounded-xl p-4 border border-white/60 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="autoTopUpAmount" className="block text-sm font-medium text-slate-700">Refill Amount (NGN)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₦</span>
                          <input
                            type="number"
                            name="autoTopUpAmount"
                            id="autoTopUpAmount"
                            defaultValue={wallet.autoTopUpAmount / 100 || 5000}
                            min={wallet.walletGroupId?.minAutoTopUpAmount ? wallet.walletGroupId.minAutoTopUpAmount / 100 : 1000}
                            max={wallet.walletGroupId?.maxAutoTopUpAmount ? wallet.walletGroupId.maxAutoTopUpAmount / 100 : undefined}
                            required
                            className="block w-full pl-8 pr-3 py-2.5 bg-white/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 backdrop-blur-md transition-all shadow-sm"
                          />
                        </div>
                        {wallet.walletGroupId?.minAutoTopUpAmount && (
                          <p className="text-[11px] text-slate-500">Min: ₦{wallet.walletGroupId.minAutoTopUpAmount / 100}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="autoTopUpTrigger" className="block text-sm font-medium text-slate-700">Trigger Threshold (NGN)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₦</span>
                          <input
                            type="number"
                            name="autoTopUpTrigger"
                            id="autoTopUpTrigger"
                            defaultValue={wallet.autoTopUpTrigger / 100 || 1000}
                            min={wallet.walletGroupId?.minAutoTopUpTrigger ? wallet.walletGroupId.minAutoTopUpTrigger / 100 : 100}
                            max={wallet.walletGroupId?.maxAutoTopUpTrigger ? wallet.walletGroupId.maxAutoTopUpTrigger / 100 : undefined}
                            required
                            className="block w-full pl-8 pr-3 py-2.5 bg-white/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 backdrop-blur-md transition-all shadow-sm"
                          />
                        </div>
                        {wallet.walletGroupId?.minAutoTopUpTrigger && (
                          <p className="text-[11px] text-slate-500">Min: ₦{wallet.walletGroupId.minAutoTopUpTrigger / 100}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button type="submit" variant="secondary" disabled={settingsLoading}>
                        {settingsLoading ? "Saving..." : "Save Settings"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Invoice History */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">Billing History</h3>
        </div>
        
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">
                      {new Date(inv.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                        inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                        inv.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        inv.status === 'refunded' ? 'bg-blue-50 text-blue-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handlePrintReceipt(inv)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Print Receipt"
                      >
                        <span className="material-symbols-outlined text-[20px] leading-none">
                          download
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top-Up Modal with Glassmorphism */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !topupLoading && setShowTopupModal(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Add Funds</h3>
                <button 
                  onClick={() => !topupLoading && setShowTopupModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <p className="text-sm text-slate-500">
                Enter the amount you would like to add to your wallet. You will be redirected to Nomba to complete the payment.
              </p>
            </div>
            
            <form onSubmit={handleTopupSubmit}>
              <div className="px-6 py-5">
                <Input
                  type="number"
                  name="topupAmount"
                  id="topupAmount"
                  label={`Amount (${wallet?.currency || 'NGN'})`}
                  placeholder="5000"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  min="100"
                  disabled={topupLoading}
                  required
                  icon="payments"
                  className="w-full text-lg"
                />
                {topupError && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {topupError}
                  </p>
                )}
              </div>
              
              <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowTopupModal(false)}
                  disabled={topupLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={topupLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-sm"
                >
                  {topupLoading ? "Processing..." : "Continue to Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal with Glassmorphism */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !actionLoading && setShowCancelModal(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-6 border-b border-slate-100 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600">warning</span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Cancel Subscription</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period.
                </p>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                Keep Subscription
              </Button>
              <button
                onClick={handleCancelSubscription}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Selector Modal */}
      {showPaymentSelectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !actionLoading && setShowPaymentSelectorModal(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Add Payment Method</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Choose how you'd like to pay for your subscription.
                </p>
              </div>
              <button 
                onClick={() => !actionLoading && setShowPaymentSelectorModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="px-6 py-6 space-y-4">
              <button
                onClick={() => {
                  setShowPaymentSelectorModal(false);
                  handleUpdatePayment();
                }}
                disabled={actionLoading}
                className="w-full flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">credit_card</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Credit / Debit Card</h4>
                  <p className="text-sm text-slate-500 mt-0.5">Link a card via secure checkout.</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPaymentSelectorModal(false);
                  setMandatePending(null);
                  setMandateForm({ bankCode: "", accountNumber: "", phoneNumber: "", accountName: "", address: "" });
                  setShowMandateModal(true);
                }}
                className="w-full flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">account_balance</span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Bank Account (Direct Debit)</h4>
                  <p className="text-sm text-slate-500 mt-0.5">Connect your NIBSS-supported bank account.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandate Setup Modal */}
      {showMandateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !mandateLoading && setShowMandateModal(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Setup Direct Debit</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Connect your bank account for automatic billing.
                </p>
              </div>
              <button 
                onClick={() => !mandateLoading && setShowMandateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {mandatePending ? (
              <div className="px-6 py-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    Validation Required
                  </h4>
                  <p className="text-sm text-amber-800 mt-2">
                    {mandatePending.message}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm text-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
                    {mandatePending.instructions}
                  </p>
                </div>

                <Button
                  variant="primary"
                  className="w-full mt-4"
                  onClick={() => setShowMandateModal(false)}
                >
                  I'll do this later
                </Button>
              </div>
            ) : (
              <form onSubmit={handleInitiateMandate}>
                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label htmlFor="bankCode" className="block text-sm font-medium text-slate-700 mb-1">
                      Bank
                    </label>
                    <div className="relative">
                      <select
                        id="bankCode"
                        required
                        disabled={mandateLoading}
                        value={mandateForm.bankCode}
                        onChange={(e) => setMandateForm({ ...mandateForm, bankCode: e.target.value })}
                        className="block w-full pl-3 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                      >
                        <option value="" disabled>Select your bank</option>
                        <option value="044">Access Bank</option>
                        <option value="058">Guaranty Trust Bank (GTB)</option>
                        <option value="033">United Bank for Africa (UBA)</option>
                        <option value="057">Zenith Bank</option>
                        <option value="011">First Bank of Nigeria</option>
                        <option value="232">Sterling Bank</option>
                        <option value="032">Union Bank</option>
                        <option value="215">Unity Bank</option>
                        <option value="035">Wema Bank</option>
                        <option value="050">Ecobank</option>
                        <option value="070">Fidelity Bank</option>
                        <option value="214">First City Monument Bank (FCMB)</option>
                        <option value="076">Polaris Bank</option>
                        <option value="082">Keystone Bank</option>
                        <option value="221">Stanbic IBTC Bank</option>
                        <option value="068">Standard Chartered Bank</option>
                        <option value="215">Unity Bank</option>
                        <option value="030">Heritage Bank</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="material-symbols-outlined text-slate-400">expand_more</span>
                      </div>
                    </div>
                  </div>

                  <Input
                    type="text"
                    name="accountNumber"
                    id="accountNumber"
                    label="Account Number (NUBAN)"
                    placeholder="0123456789"
                    value={mandateForm.accountNumber}
                    onChange={(e) => setMandateForm({ ...mandateForm, accountNumber: e.target.value })}
                    disabled={mandateLoading}
                    required
                    pattern="\d{10}"
                    title="Must be a 10-digit account number"
                    icon="account_balance"
                  />

                  <Input
                    type="tel"
                    name="phoneNumber"
                    id="phoneNumber"
                    label="Phone Number"
                    placeholder="08012345678"
                    value={mandateForm.phoneNumber}
                    onChange={(e) => setMandateForm({ ...mandateForm, phoneNumber: e.target.value })}
                    disabled={mandateLoading}
                    required
                    icon="phone"
                  />

                  <Input
                    type="text"
                    name="accountName"
                    id="accountName"
                    label="Account Name"
                    placeholder="e.g. John Doe"
                    value={mandateForm.accountName}
                    onChange={(e) => setMandateForm({ ...mandateForm, accountName: e.target.value })}
                    disabled={mandateLoading}
                    required
                    minLength={3}
                    maxLength={100}
                    icon="person"
                  />

                  <Input
                    type="text"
                    name="address"
                    id="address"
                    label="Billing Address"
                    placeholder="123 Example Street"
                    value={mandateForm.address}
                    onChange={(e) => setMandateForm({ ...mandateForm, address: e.target.value })}
                    disabled={mandateLoading}
                    required
                    minLength={5}
                    maxLength={150}
                    icon="location_on"
                  />
                </div>
                
                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowMandateModal(false)}
                    disabled={mandateLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={mandateLoading}
                  >
                    {mandateLoading ? "Setting up..." : "Continue"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
            : "bg-red-50 border-red-200 text-red-950"
        }`}>
          <span className={`material-symbols-outlined text-[20px] ${
            toast.type === "success" ? "text-emerald-600" : "text-red-600"
          }`}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className={`transition-colors flex-shrink-0 ${
              toast.type === "success" ? "text-emerald-500 hover:text-emerald-700" : "text-red-500 hover:text-red-700"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] leading-none">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalDashboard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    }>
      <PortalDashboardContent />
    </Suspense>
  );
}
