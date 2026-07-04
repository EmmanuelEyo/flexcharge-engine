"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import ChangePlanModal from "@/components/dashboard/ChangePlanModal";

export type SubscriberStatus = "active" | "past_due" | "canceled" | "paused" | "trialing" | "unpaid" | "pending";

export interface Subscriber {
  id: string;
  customerId: string;
  name: string;
  email: string;
  plan: string;
  planColor: string;
  status: SubscriberStatus;
  amount: string;
  nextBilling: string;
  since: string;
  avatar?: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_CONFIG: Record<
  SubscriberStatus,
  { label: string; dot: string; badge: string }
> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  trialing: {
    label: "Trialing",
    dot: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-600 border-emerald-100",
  },
  past_due: {
    label: "Past Due",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-100",
  },
  canceled: {
    label: "Cancelled",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-500 border-slate-200",
  },
  paused: {
    label: "Paused",
    dot: "bg-blue-400",
    badge: "bg-blue-50 text-blue-600 border-blue-100",
  },
  unpaid: {
    label: "Unpaid",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-100",
  },
  pending: {
    label: "Pending",
    dot: "bg-slate-300",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

type FilterTab = "all" | SubscriberStatus;
const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "paused", label: "Paused" },
  { value: "canceled", label: "Cancelled" },
];

const PER_PAGE = 6;

function StatusBadge({ status }: { status: SubscriberStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center font-semibold ${avatarColor(name)}`}
    >
      {getInitials(name)}
    </div>
  );
}

function SubscriberDrawer({
  subscriber,
  onClose,
  onUpdate,
}: {
  subscriber: Subscriber | null;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!subscriber) return null;
  const cfg = STATUS_CONFIG[subscriber.status];

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    try {
      setLoadingAction(action);
      await api.post(`/subscriptions/${subscriber.id}/${action}`);
      onUpdate();
      if (action === 'cancel') {
        onClose();
      }
    } catch (error) {
      console.error(`Failed to ${action} subscription:`, error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGenerateLink = async () => {
    try {
      setLoadingAction("generate_link");
      const res = await api.post(`/portal/sessions`, { customerId: subscriber.customerId });
      if (res.data?.data?.portalUrl) {
        navigator.clipboard.writeText(res.data.data.portalUrl).catch(() => {});
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (error) {
      console.error("Failed to generate portal link:", error);
      alert("Failed to generate portal link");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {showChangePlan && (
        <ChangePlanModal 
          subscriptionId={subscriber.id} 
          currentPlanName={subscriber.plan} 
          onClose={() => setShowChangePlan(false)} 
          onUpdate={() => {
            onUpdate();
            onClose(); // Close drawer after plan change
          }} 
        />
      )}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-slide-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">
            Subscriber Details
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">
              close
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold ${avatarColor(subscriber.name)}`}
            >
              {getInitials(subscriber.name)}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">
                {subscriber.name}
              </p>
              <p className="text-sm text-slate-500">{subscriber.email}</p>
              <div className="mt-1.5">
                <StatusBadge status={subscriber.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Plan", value: subscriber.plan },
              { label: "Amount", value: subscriber.amount },
              { label: "Next Billing", value: subscriber.nextBilling },
              { label: "Member Since", value: subscriber.since },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-slate-50 rounded-xl p-3 border border-slate-100"
              >
                <p className="text-xs text-slate-400 font-medium mb-1">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Recent Activity
            </p>
            <div className="space-y-3">
              {[
                {
                  icon: "person_add",
                  color: "text-indigo-500",
                  label: "Subscribed to plan",
                  time: subscriber.since,
                },
              ].map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className={`material-symbols-outlined text-[18px] leading-none mt-0.5 flex-shrink-0 ${ev.color}`}
                  >
                    {ev.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{ev.label}</p>
                    <p className="text-xs text-slate-400">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-3">
          {(subscriber.status === "active" || subscriber.status === "trialing") && (
            <button 
              onClick={() => setShowChangePlan(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">swap_horiz</span>
              Change Plan
            </button>
          )}

          <button 
            onClick={handleGenerateLink}
            disabled={!!loadingAction}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {loadingAction === 'generate_link' ? <span className="material-symbols-outlined animate-spin text-[16px] leading-none">sync</span> : <span className="material-symbols-outlined text-[16px] leading-none">link</span>}
            Generate Portal Link
          </button>
          <div className="flex gap-3">
            {subscriber.status === "active" ? (
              <button 
                onClick={() => handleAction('pause')}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loadingAction === 'pause' ? <span className="material-symbols-outlined animate-spin text-[16px] leading-none">sync</span> : <span className="material-symbols-outlined text-[16px] leading-none">pause</span>}
                Pause
              </button>
            ) : subscriber.status === "paused" ? (
              <button 
                onClick={() => handleAction('resume')}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loadingAction === 'resume' ? <span className="material-symbols-outlined animate-spin text-[16px] leading-none">sync</span> : <span className="material-symbols-outlined text-[16px] leading-none">play_arrow</span>}
                Resume
              </button>
            ) : null}
            {subscriber.status !== "canceled" && (
              <button 
                onClick={() => handleAction('cancel')}
                disabled={!!loadingAction}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loadingAction === 'cancel' ? <span className="material-symbols-outlined animate-spin text-[16px] leading-none">sync</span> : <span className="material-symbols-outlined text-[16px] leading-none">cancel</span>}
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {copiedLink && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in duration-300">
          <span className="material-symbols-outlined text-[15px] leading-none text-emerald-400">
            check_circle
          </span>
          Portal link copied to clipboard
        </div>
      )}
    </>
  );
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/subscriptions");
      if (res.data?.data) {
        const mapped = res.data.data.map((sub: any) => ({
          id: sub._id,
          customerId: sub.customerId?._id || "",
          name: sub.customerId?.name || "Unknown",
          email: sub.customerId?.email || "",
          plan: sub.planId?.name || "Unknown Plan",
          planColor: "bg-indigo-50 text-indigo-700",
          status: sub.status,
          amount: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format((sub.planId?.amount || 0) / 100),
          nextBilling: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
          since: new Date(sub.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        }));
        setSubscribers(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const filtered = useMemo(() => {
    return subscribers.filter((s) => {
      const matchesFilter =
        activeFilter === "all" || s.status === activeFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.plan.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [search, activeFilter, subscribers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleFilter(f: FilterTab) {
    setActiveFilter(f);
    setPage(1);
  }
  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleCopyEmail(email: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(email).catch(() => { });
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  const handleExportCSV = () => {
    if (subscribers.length === 0) return;
    const headers = ["Name", "Email", "Plan", "Status", "Amount", "Next Billing", "Member Since"];
    const rows = subscribers.map(s => [
      `"${s.name}"`, `"${s.email}"`, `"${s.plan}"`, s.status, `"${s.amount}"`, `"${s.nextBilling}"`, `"${s.since}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `subscribers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    const all = subscribers;
    return {
      total: all.length,
      active: all.filter((s) => s.status === "active").length,
      pastDue: all.filter((s) => s.status === "past_due").length,
      canceled: all.filter((s) => s.status === "canceled").length,
      paused: all.filter((s) => s.status === "paused").length,
    };
  }, [subscribers]);

  return (
    <>
      <SubscriberDrawer
        subscriber={selected}
        onClose={() => setSelected(null)}
        onUpdate={fetchSubscribers}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Subscribers
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} total subscribers across all plans
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon="download" size="md" onClick={handleExportCSV}>
            Export
          </Button>
          <Button variant="primary" icon="person_add" size="md">
            Add Subscriber
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total",
            value: stats.total,
            icon: "group",
            color: "bg-slate-100 text-slate-600",
          },
          {
            label: "Active",
            value: stats.active,
            icon: "check_circle",
            color: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Past Due",
            value: stats.pastDue,
            icon: "schedule",
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "Paused / Cancelled",
            value: stats.paused + stats.canceled,
            icon: "pause_circle",
            color: "bg-slate-100 text-slate-500",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.color}`}
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                {s.icon}
              </span>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900 leading-tight">
                {s.value}
              </p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">

        <div className="px-4 pt-4 pb-0 border-b border-slate-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] leading-none pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search name, email or plan…"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 transition-all"
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">
                    close
                  </span>
                </button>
              )}
            </div>

            <div className="ml-auto text-sm text-slate-400 hidden sm:block">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.value === "all"
                  ? subscribers.length
                  : subscribers.filter((s) => s.status === tab.value).length;
              const isActive = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => handleFilter(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${isActive
                      ? "border-[#4F46E5] text-[#4F46E5]"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {["Subscriber", "Plan", "Status", "Amount", "Next Billing", "Since", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`py-3 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === "" ? "text-right w-12" : ""
                        }`}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm relative">
              {loading && paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <span className="material-symbols-outlined text-[40px] text-slate-300">
                        search_off
                      </span>
                      <p className="font-medium text-slate-500">
                        No subscribers found
                      </p>
                      <p className="text-sm">
                        {search
                          ? `No results for "${search}"`
                          : `No ${activeFilter === "all" ? "" : activeFilter.replace("_", " ")} subscribers yet.`}
                      </p>
                      {search && (
                        <button
                          onClick={() => handleSearch("")}
                          className="text-sm text-[#4F46E5] hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={sub.name} />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {sub.name}
                          </p>
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-slate-400 truncate">
                              {sub.email}
                            </p>
                            <button
                              onClick={(e) => handleCopyEmail(sub.email, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-[#4F46E5] flex-shrink-0"
                              title="Copy email"
                            >
                              <span className="material-symbols-outlined text-[13px] leading-none">
                                {copiedEmail === sub.email
                                  ? "check"
                                  : "content_copy"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sub.planColor}`}
                        title={sub.plan}
                      >
                        <span className="max-w-[100px] truncate">{sub.plan}</span>
                      </span>
                    </td>


                    <td className="py-3.5 px-5">
                      <StatusBadge status={sub.status} />
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-slate-900">
                      {sub.amount}
                    </td>

                    <td className="py-3.5 px-5 text-slate-500">
                      {sub.nextBilling}
                    </td>


                    <td className="py-3.5 px-5 text-slate-400 text-xs">
                      {sub.since}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(sub);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-400 hover:text-[#4F46E5] p-1.5 rounded-full hover:bg-indigo-50"
                      >
                        <span className="material-symbols-outlined text-[18px] leading-none">
                          more_vert
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {(page - 1) * PER_PAGE + 1}
              </span>{" "}
              –{" "}
              <span className="font-medium text-slate-700">
                {Math.min(page * PER_PAGE, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">
                {filtered.length}
              </span>{" "}
              subscribers
            </p>

            <div className="flex items-center gap-1">
               <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === page
                      ? "bg-[#4F46E5] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100"
                    }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {copiedEmail && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-[15px] leading-none text-emerald-400">
            check_circle
          </span>
          Email copied to clipboard
        </div>
      )}
    </>
  );
}
