"use client";

import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/constants";
import Button from "@/components/ui/Button";

interface PublicPlan {
  _id: string;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  description: string;
  tenantId: {
    _id: string;
    businessName?: string;
    logoUrl?: string;
  };
}

export default function PayPage({
  params,
}: {
  params: { planId: string };
}) {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/plans/public/${params.planId}`);
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load plan");
        }
        
        setPlan(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlan();
  }, [params.planId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setProcessing(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions/public-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: params.planId, email, name }),
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate checkout");
      }

      if (data.data.checkoutLink) {
        window.location.href = data.data.checkoutLink;
      } else {
        throw new Error("No checkout link returned. Nomba integration might be disabled.");
      }
      
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Checkout Error</h1>
          <p className="text-slate-500 mb-6">{error || "Plan not found."}</p>
        </div>
      </div>
    );
  }

  const amountFormatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: plan.currency,
  }).format(plan.amount / 100);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* LEFT SIDE: Payment Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          {/* Tenant Branding */}
          <div className="mb-10">
            {plan.tenantId?.logoUrl ? (
              <img src={plan.tenantId.logoUrl} alt={plan.tenantId.businessName} className="h-10 mb-4" />
            ) : (
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-indigo-600 text-2xl">bolt</span>
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-900">{plan.tenantId?.businessName || "FlexCharge Merchant"}</h1>
            <p className="text-slate-500 mt-1">Complete your subscription</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={processing}
              className="w-full flex items-center justify-center py-3.5 px-4 rounded-lg bg-[#4F46E5] hover:bg-[#4338ca] text-white font-semibold text-base transition-colors disabled:opacity-70"
            >
              {processing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                `Proceed to Payment (${amountFormatted})`
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span>Secured by Nomba</span>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT SIDE: Order Summary */}
      <div className="w-full md:w-1/2 bg-slate-50 border-l border-slate-200 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Subscription Summary</h2>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-medium text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 capitalize">{plan.interval} billing</p>
              </div>
              <span className="font-medium text-slate-900">{amountFormatted}</span>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Base Fee</span>
                <span className="text-slate-900">{amountFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tax</span>
                <span className="text-slate-900">NGN 0.00</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200">
              <span className="font-semibold text-slate-900">Total Amount</span>
              <span className="text-xl font-bold text-[#4F46E5]">{amountFormatted}</span>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <span className="text-xs text-slate-400">Powered by FlexCharge</span>
          </div>
        </div>
      </div>
    </div>
  );
}
