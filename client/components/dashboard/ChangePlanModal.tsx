/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";

interface Plan {
  _id: string;
  name: string;
  amount: number;
  interval: string;
}

interface ChangePlanModalProps {
  subscriptionId: string;
  currentPlanName: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ChangePlanModal({ subscriptionId, currentPlanName, onClose, onUpdate }: ChangePlanModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bypassPayment, setBypassPayment] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await api.get("/plans?active=true");
        setPlans(res.data?.data || []);
      } catch (err) {
        console.error("Failed to load plans", err);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const handleSimulate = async (newPlanId: string) => {
      setSelectedPlanId(newPlanId);
      if (!newPlanId) {
        setSimulation(null);
        setError("");
        return;
      }
    try {
      setSimulating(true);
      setError("");
      const res = await api.post(`/subscriptions/${subscriptionId}/simulate-change`, {
        newPlanId
      });
      setSimulation(res.data?.data);
    } catch (err: any) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to simulate plan change");
      setSimulation(null);
    } finally {
      setSimulating(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPlanId) return;
    try {
      setSubmitting(true);
      setError("");

      await api.post(`/subscriptions/${subscriptionId}/change-plan`, {
        newPlanId: selectedPlanId,
        bypassPayment,
      });

      onUpdate();
      onClose();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || "Failed to change plan";
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Change Subscription Plan</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined leading-none">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <p className="text-sm text-slate-500 mb-4">
            Current Plan: <span className="font-semibold text-slate-900">{currentPlanName}</span>
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select New Plan</label>
            {loading ? (
              <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                value={selectedPlanId}
                onChange={(e) => handleSimulate(e.target.value)}
              >
                <option value="">-- Choose a plan --</option>
                {plans.map(p => (
                  <option key={p._id} value={p._id}>{p.name} - ₦{(p.amount / 100).toLocaleString()}/{p.interval}</option>
                ))}
              </select>
            )}
          </div>

          {simulating && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
              {error}
            </div>
          )}

          {simulation && !simulating && !error && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500 text-[18px]">info</span>
                Proration Preview
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Unused Credit:</span>
                <span className="font-medium text-emerald-600">{simulation.invoice.creditFormatted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">New Plan Cost (Remaining):</span>
                <span className="font-medium text-slate-900">
                  {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(simulation.proration.newPlanCostRemaining / 100)}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-between">
                <span className="font-semibold text-slate-700">Amount Due Now:</span>
                <span className="font-bold text-slate-900 text-lg">{simulation.invoice.amountDueFormatted}</span>
              </div>
              
              {simulation.invoice.amountDue > 0 && (
                <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="bypassPayment"
                    checked={bypassPayment}
                    onChange={(e) => setBypassPayment(e.target.checked)}
                    className="h-4.5 w-4.5 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="text-sm select-none">
                    <label htmlFor="bypassPayment" className="font-medium text-slate-950 cursor-pointer">
                      Process as offline/complimentary payment
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bypasses charging the saved payment card and changes the plan immediately.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedPlanId || submitting || simulating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}
