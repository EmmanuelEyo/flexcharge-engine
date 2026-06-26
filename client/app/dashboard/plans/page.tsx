"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import PlanCard, { Plan } from "@/components/dashboard/PlanCard";
import CreatePlanModal, {
  PlanFormData,
} from "@/components/dashboard/CreatePlanModal";

const MOCK_PLANS: Plan[] = [
  {
    id: "plan_pro_001",
    name: "Pro Monthly",
    currency: "NGN",
    amount: 25000,
    interval: "monthly",
    description: "Full access to all Pro features with priority support.",
    subscribers: 312,
    status: "active",
    createdAt: "Oct 1, 2023",
  },
  {
    id: "plan_basic_001",
    name: "Basic Monthly",
    currency: "NGN",
    amount: 5000,
    interval: "monthly",
    description: "Essential tools for small businesses just getting started.",
    subscribers: 489,
    status: "active",
    createdAt: "Sep 15, 2023",
  },
  {
    id: "plan_ent_001",
    name: "Enterprise",
    currency: "NGN",
    amount: 150000,
    interval: "yearly",
    description:
      "Tailored for large teams. Dedicated account manager included.",
    subscribers: 42,
    status: "active",
    createdAt: "Aug 3, 2023",
  },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(MOCK_PLANS);
  const [modalOpen, setModalOpen] = useState(plans.length === 0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasPlans = plans.length > 0;

  function handleCreatePlan(data: PlanFormData) {
    const newPlan: Plan = {
      id: `plan_${Date.now()}`,
      name: data.name,
      currency: data.currency,
      amount: parseFloat(data.amount) || 0,
      interval: data.interval,
      description: data.description,
      subscribers: 0,
      status: "active",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    setPlans((prev) => [newPlan, ...prev]);
    setModalOpen(false);
  }

  function handleToggleStatus(plan: Plan) {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === plan.id ? { ...p, status: p.status === "active" ? "inactive" : "active" } : p
      )
    );
  }

  function handleCopyId(id: string) {
    navigator.clipboard.writeText(id).catch(() => { });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      {!hasPlans && (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm">
            <span className="material-symbols-outlined text-[40px] text-[#4F46E5]">
              payments
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            No plans yet
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
            Create your first billing plan to start accepting recurring payments
            from your subscribers.
          </p>
          <Button variant="primary" icon="add" size="lg" onClick={() => setModalOpen(true)}>
            Create Your First Plan
          </Button>
        </div>
      )}

      {hasPlans && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Plans
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {plans.length} plan{plans.length !== 1 ? "s" : ""} · manage
                your billing offerings
              </p>
            </div>
            <Button variant="primary" icon="add" onClick={() => setModalOpen(true)}>
              New Plan
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Plans",
                value: plans.length,
                icon: "payments",
                color: "text-indigo-600 bg-indigo-50",
              },
              {
                label: "Active",
                value: plans.filter((p) => p.status === "active").length,
                icon: "check_circle",
                color: "text-emerald-600 bg-emerald-50",
              },
              {
                label: "Total Subscribers",
                value: plans.reduce((s, p) => s + p.subscribers, 0),
                icon: "group",
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Inactive",
                value: plans.filter((p) => p.status === "inactive").length,
                icon: "pause_circle",
                color: "text-slate-500 bg-slate-100",
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                  <span className="material-symbols-outlined text-[18px] leading-none">
                    {stat.icon}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 leading-tight">
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-700">
                All Plans
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {plans.filter((p) => p.status === "active").length} active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onToggleStatus={handleToggleStatus} onCopyId={handleCopyId} />
              ))}

              <button onClick={() => setModalOpen(true)} className="rounded-xl border-2 border-dashed border-slate-200 hover:border-[#4F46E5] hover:bg-indigo-50/30 transition-all duration-200 flex flex-col items-center justify-center gap-3 p-8 text-slate-400 hover:text-[#4F46E5] min-h-[200px] group">
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[24px] leading-none">
                    add
                  </span>
                </div>
                <span className="text-sm font-medium">Add another plan</span>
              </button>
            </div>
          </section>
        </>
      )}

      {copiedId && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <span className="material-symbols-outlined text-[15px] leading-none text-emerald-400">
            check_circle
          </span>
          Plan ID copied to clipboard
        </div>
      )}

      <CreatePlanModal open={modalOpen} onClose={() => { if (hasPlans) setModalOpen(false); }} onSubmit={handleCreatePlan} />
    </>
  );
}
