import React from "react";
import Button from "@/components/ui/Button";
import StatCard from "@/components/dashboard/StatCard";
import TransactionTable from "@/components/dashboard/TransactionTable";

const stats = [
  {
    label: "Total Revenue",
    value: "₦4,500,000",
    change: "12%",
    trend: "up" as const,
    icon: "account_balance_wallet",
    iconColor: "bg-emerald-50 text-emerald-600",
  },
  {
    label: "Active Subscribers",
    value: "843",
    change: "5%",
    trend: "up" as const,
    icon: "group",
    iconColor: "bg-blue-50 text-blue-600",
  },
  {
    label: "Churn Rate",
    value: "2.1%",
    change: "0.5%",
    trend: "down" as const,
    icon: "trending_down",
    iconColor: "bg-purple-50 text-purple-600",
  },
];

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Overview
          </h2>
          <p className="text-base text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon="download">
            Export
          </Button>
          <Button variant="primary" icon="add">
            New Charge
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} change={stat.change}
            trend={stat.trend} icon={stat.icon} iconColor={stat.iconColor} />
        ))}
      </section>
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <h3 className="text-xl font-semibold text-slate-900">
            Recent Transactions
          </h3>
          <a href="#" className="text-sm font-medium text-[#4F46E5] hover:text-[#4338ca] transition-colors"> View all </a>
        </div>
        <TransactionTable />
      </section>
    </>
  );
}
