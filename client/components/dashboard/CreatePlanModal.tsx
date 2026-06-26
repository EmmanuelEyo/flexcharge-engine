"use client";

import React, { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";

export type BillingInterval = "weekly" | "monthly" | "yearly";

export interface PlanFormData {
  name: string;
  currency: "NGN" | "USD";
  amount: string;
  interval: BillingInterval;
  description: string;
}

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PlanFormData) => void;
}

export default function CreatePlanModal({ open, onClose, onSubmit, }: CreatePlanModalProps) {
  const [form, setForm] = React.useState<PlanFormData>({
    name: "",
    currency: "NGN",
    amount: "",
    interval: "monthly",
    description: "",
  });

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const currencySymbol = form.currency === "NGN" ? "₦" : "$";

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">
            Create New Plan
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close modal">
            <span className="material-symbols-outlined text-[20px] leading-none">
              close
            </span>
          </button>
        </div>

        <form id="create-plan-form" onSubmit={handleSubmit} className="px-6 py-6 flex-1 overflow-y-auto space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="plan-name" className="block text-sm font-medium text-slate-600">
              Plan Name
            </label>
            <input id="plan-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Premium Monthly" className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="currency" className="block text-sm font-medium text-slate-600">
                Currency
              </label>
              <div className="relative">
                <select id="currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as "NGN" | "USD", })} className="w-full appearance-none bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all cursor-pointer">
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px] leading-none">
                  expand_more
                </span>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="amount" className="block text-sm font-medium text-slate-600">
                Amount
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-slate-500 text-sm select-none font-medium">
                  {currencySymbol}
                </span>
                <input id="amount" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-600">
              Billing Interval
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
              {(["weekly", "monthly", "yearly"] as BillingInterval[]).map(
                (val) => (
                  <label key={val} className="cursor-pointer relative">
                    <input type="radio" name="interval" value={val} checked={form.interval === val} onChange={() => setForm({ ...form, interval: val })} className="sr-only peer" />
                    <div className="text-center py-2 rounded-md text-sm font-medium text-slate-500 peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm transition-all capitalize">
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </div>
                  </label>
                )
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-sm font-medium text-slate-600">
              Description{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea id="description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Briefly describe what this plan includes..."
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all resize-none placeholder:text-slate-400"
            />
          </div>
        </form>

        <div className="px-6 py-5 border-t border-slate-200 flex justify-end items-center gap-3 flex-shrink-0 bg-white">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-plan-form">
            Create Plan
          </Button>
        </div>
      </div>
    </div>
  );
}
