import React from "react";

type TrendDirection = "up" | "down" | "neutral";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: TrendDirection;
  icon?: string;
  iconColor?: string;
}

export default function StatCard({ label, value, change, trend = "neutral", icon, iconColor = "bg-slate-100 text-slate-500",
}: StatCardProps) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  const badgeClass = isPositive ? "text-emerald-600 bg-emerald-50" : isNegative ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-100";

  const arrowIcon = isPositive ? "arrow_upward" : isNegative ? "arrow_downward" : null;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColor}`}>
            <span className="material-symbols-outlined text-[18px] leading-none">
              {icon}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2">
        <h3 className="text-4xl font-bold tracking-tight text-slate-900 leading-none">
          {value}
        </h3>
      </div>

      {change && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>
            {arrowIcon && (
              <span className="material-symbols-outlined text-[14px] leading-none">
                {arrowIcon}
              </span>
            )}
            {change}
          </span>
          <span className="text-sm text-slate-500 ml-1">vs last month</span>
        </div>
      )}
    </div>
  );
}
