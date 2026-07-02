"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import PlanCard, { Plan } from "@/components/dashboard/PlanCard";
import CreatePlanModal, {
  PlanFormData,
} from "@/components/dashboard/CreatePlanModal";
import api from "@/lib/api";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/plans");
      const raw: any[] = res.data?.data ?? [];

      // Map backend plan shape → PlanCard shape
      const mapped: Plan[] = raw.map((p: any) => ({
        id: p._id,
        name: p.name,
        currency: p.currency ?? "NGN",
        // Backend stores amount in kobo — convert to naira for display
        amount: p.amount / 100,
        interval: p.interval,
        description: p.description ?? "",
        subscribers: 0, // subscriber count loaded separately if needed
        status: p.isActive ? "active" : "inactive",
        createdAt: new Date(p.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        slug: p.slug,
      }));

      setPlans(mapped);
      // Open modal automatically if tenant has no plans yet
      if (mapped.length === 0) setModalOpen(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreatePlan = async (data: PlanFormData) => {
    setCreating(true);
    try {
      // Backend expects amount in kobo (integer)
      const amountInKobo = Math.round(parseFloat(data.amount) * 100);

      await api.post("/plans", {
        name: data.name,
        currency: data.currency,
        amount: amountInKobo,
        interval: data.interval,
        description: data.description || undefined,
      });

      setModalOpen(false);
      await fetchPlans(); // refresh list with real _id from DB
    } catch (err: any) {
      alert(err.message ?? "Failed to create plan");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (plan: Plan) => {
    try {
      await api.patch(`/plans/${plan.id}`, {
        isActive: plan.status !== "active",
      });
      await fetchPlans();
    } catch (err: any) {
      alert(err.message ?? "Failed to update plan");
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasPlans = plans.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <span className="material-symbols-outlined text-red-500 text-5xl mb-4">error</span>
        <p className="text-slate-700 font-medium mb-4">{error}</p>
        <Button variant="secondary" onClick={fetchPlans}>Try Again</Button>
      </div>
    );
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
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onToggleStatus={handleToggleStatus}
                  onCopyId={handleCopyId}
                />
              ))}

              <button
                onClick={() => setModalOpen(true)}
                className="rounded-xl border-2 border-dashed border-slate-200 hover:border-[#4F46E5] hover:bg-indigo-50/30 transition-all duration-200 flex flex-col items-center justify-center gap-3 p-8 text-slate-400 hover:text-[#4F46E5] min-h-[200px] group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[24px] leading-none">
                    add
                  </span>
                </div>
                <span className="text-sm font-medium">Add another plan</span>
              </button>
            </div>
          </section>

          {/* Share link helper — shows checkout URL for each plan */}
          <section className="mt-2">
            <h3 className="text-base font-semibold text-slate-700 mb-3">Checkout Links</h3>
            <div className="space-y-2">
              {plans.filter(p => p.status === "active").map(plan => {
                const checkoutUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${plan.id}`;
                return (
                  <div key={plan.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <span className="material-symbols-outlined text-[18px] text-indigo-500">link</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{plan.name}</p>
                      <p className="text-xs text-slate-400 truncate">{checkoutUrl}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(checkoutUrl).catch(() => {});
                        setCopiedId(`link_${plan.id}`);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copiedId === `link_${plan.id}` ? "check" : "content_copy"}
                      </span>
                      {copiedId === `link_${plan.id}` ? "Copied!" : "Copy"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {copiedId && !copiedId.startsWith("link_") && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
          <span className="material-symbols-outlined text-[15px] leading-none text-emerald-400">
            check_circle
          </span>
          Plan ID copied to clipboard
        </div>
      )}

      <CreatePlanModal
        open={modalOpen}
        onClose={() => { if (hasPlans) setModalOpen(false); }}
        onSubmit={handleCreatePlan}
        isSubmitting={creating}
      />
    </>
  );
}
