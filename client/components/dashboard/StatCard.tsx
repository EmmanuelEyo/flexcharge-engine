interface StatCardProps {
  label: string;
  value: string | number;
  /** Optional percentage change, e.g. "+12%" */
  change?: string;
  /** "up" | "down" | "neutral" */
  trend?: "up" | "down" | "neutral";
}

export default function StatCard({
  label,
  value,
  change,
  trend = "neutral",
}: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-gray-400";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {change && (
        <p className={`text-xs font-medium ${trendColor}`}>{change} vs last period</p>
      )}
    </div>
  );
}
