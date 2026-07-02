import React from "react";

export type PlanInterval = "weekly" | "monthly" | "yearly";

export interface Plan {
  id: string;
  name: string;
  currency: "NGN" | "USD";
  amount: number;
  interval: PlanInterval;
  description?: string;
  subscribers: number;
  status: "active" | "inactive";
  createdAt: string;
  slug?: string;
}

interface PlanCardProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onCopyId?: (id: string) => void;
  onToggleStatus?: (plan: Plan) => void;
}

const INTERVAL_LABEL: Record<PlanInterval, string> = {
  weekly: "/ week",
  monthly: "/ mo",
  yearly: "/ yr",
};

const INTERVAL_BADGE_COLOR: Record<PlanInterval, string> = {
  weekly: "bg-amber-50 text-amber-700 border-amber-100",
  monthly: "bg-blue-50 text-blue-700 border-blue-100",
  yearly: "bg-purple-50 text-purple-700 border-purple-100",
};

function formatAmount(currency: "NGN" | "USD", amount: number) {
  const symbol = currency === "NGN" ? "₦" : "$";
  return `${symbol}${amount.toLocaleString("en-NG")}`;
}

export default function PlanCard({ plan, onEdit, onCopyId, onToggleStatus, }: PlanCardProps) {
  const isActive = plan.status === "active";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group">
      <div className={`h-1 w-full ${isActive ? "bg-[#4F46E5]" : "bg-slate-200"}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {plan.name}
            </h3>
            {plan.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-4">
                {plan.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"}`} >
              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isActive ? "Active" : "Inactive"}
            </span>

            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${INTERVAL_BADGE_COLOR[plan.interval]}`} >
              {plan.interval}
            </span>
          </div>
        </div>

        <div>
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {formatAmount(plan.currency, plan.amount)}
          </span>
          <span className="text-sm text-slate-400 ml-1">
            {INTERVAL_LABEL[plan.interval]}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] leading-none text-slate-400">
              group
            </span>
            <span>
              <span className="font-semibold text-slate-700">
                {plan.subscribers}
              </span>{" "}
              subscribers
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="material-symbols-outlined text-[16px] leading-none text-slate-400">
              calendar_today
            </span>
            <span>{plan.createdAt}</span>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <button onClick={() => onEdit?.(plan)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#4F46E5] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-50">
          <span className="material-symbols-outlined text-[15px] leading-none">edit</span>
          Edit
        </button>
        <button onClick={() => onCopyId?.(plan.id)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#4F46E5] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-50">
          <span className="material-symbols-outlined text-[15px] leading-none">content_copy</span>
          Copy ID
        </button>
        <button onClick={() => onToggleStatus?.(plan)} className={`flex items-center gap-1.5 text-xs font-medium transition-colors px-2.5 py-1.5 rounded-lg ml-auto ${isActive ? "text-slate-500 hover:text-red-600 hover:bg-red-50" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"}`}>
          <span className="material-symbols-outlined text-[15px] leading-none"> {isActive ? "pause_circle" : "play_circle"}</span>
          {isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
