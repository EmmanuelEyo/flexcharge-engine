"use client";

import React, { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import StatCard from "@/components/dashboard/StatCard";
import TransactionTable, { Transaction, TransactionStatus } from "@/components/dashboard/TransactionTable";
import RevenueChart from "@/components/dashboard/RevenueChart";
import api from "@/lib/api";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    mrr: 0,
    activeSubscribers: 0,
    churnRate: 0,
  });
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const handleExportCSV = () => {
    if (recentTransactions.length === 0) return;
    
    // Simple CSV generation
    const headers = ["ID", "Customer", "Plan", "Amount", "Status", "Date"];
    const rows = recentTransactions.map(tx => [
      tx.id,
      `"${tx.customer}"`,
      `"${tx.plan}"`,
      `"${tx.amount}"`,
      tx.status,
      `"${tx.date}"`
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, historicalRes, invoicesRes] = await Promise.all([
        api.get("/analytics/current"),
        api.get("/analytics/historical?days=30"),
        api.get("/invoices"),
      ]);

      const data = metricsRes.data?.data;
      if (data) {
        setMetrics({
          mrr: data.mrr,
          activeSubscribers: data.activeSubscribers,
          churnRate: data.churnRate,
        });
      }

      const history = historicalRes.data?.data;
      if (history) {
        setHistoricalData(history);
      }

      const invoices = invoicesRes.data?.data;
      if (invoices && Array.isArray(invoices)) {
        const mappedTransactions = invoices.map((inv: any): Transaction => {
          let status: TransactionStatus = "Pending";
          if (inv.status === "paid") status = "Paid";
          if (inv.status === "failed") status = "Failed";

          return {
            id: inv._id,
            customer: inv.customerId?.name || "Unknown Customer",
            plan: inv.subscriptionId?.planId?.name || inv.description || "Unknown Plan",
            amount: formatCurrency(inv.amount),
            status,
            date: new Date(inv.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            }),
          };
        });
        setRecentTransactions(mappedTransactions);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTrend = (current: number, past: number, isChurn = false) => {
    if (!past) return { trend: "neutral" as const, change: undefined };
    const diff = current - past;
    let pct = isChurn ? diff : (diff / past) * 100;
    
    // For churn, going down is good (up trend in positivity), going up is bad.
    // Wait, the UI considers 'up' arrow as positive (green) and 'down' arrow as negative (red).
    // For Churn Rate, if diff < 0 (churn dropped), it's a good thing, so we might want a green down arrow?
    // Let's just use 'up' for increase and 'down' for decrease, and let the user decide.
    // Actually, StatCard colors "up" as emerald and "down" as red.
    // For churn, if it goes down, we want emerald, but the arrow would point up if we pass "up".
    // Let's keep it simple: "up" is positive growth, "down" is negative growth.
    // If churn is lower, it's a positive trend.
    const isPositive = isChurn ? diff < 0 : diff > 0;
    const isNeutral = diff === 0;
    
    const formattedChange = Math.abs(pct).toFixed(1) + (isChurn ? "%" : "%");
    
    return {
      trend: isNeutral ? "neutral" as const : isPositive ? "up" as const : "down" as const,
      change: isNeutral ? undefined : formattedChange,
    };
  };

  const mrrTrend = getTrend(metrics.mrr, historicalData[0]?.mrr);
  const subsTrend = getTrend(metrics.activeSubscribers, historicalData[0]?.activeSubscribers);
  const churnTrend = getTrend(metrics.churnRate, historicalData[0]?.churnRate, true);

  const stats = [
    {
      label: "Monthly Recurring Revenue",
      value: loading ? "..." : formatCurrency(metrics.mrr),
      trend: mrrTrend.trend,
      change: mrrTrend.change,
      icon: "account_balance_wallet",
      iconColor: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Active Subscribers",
      value: loading ? "..." : metrics.activeSubscribers.toLocaleString(),
      trend: subsTrend.trend,
      change: subsTrend.change,
      icon: "group",
      iconColor: "bg-blue-50 text-blue-600",
    },
    {
      label: "Churn Rate",
      value: loading ? "..." : `${metrics.churnRate}%`,
      trend: churnTrend.trend,
      change: churnTrend.change,
      icon: "trending_down",
      iconColor: "bg-purple-50 text-purple-600",
    },
  ];

  const paginatedTransactions = recentTransactions.slice(
    (txPage - 1) * ITEMS_PER_PAGE, 
    txPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Overview
          </h2>
          <p className="text-base text-slate-500 mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon="download" onClick={handleExportCSV}>
            Export Report
          </Button>
          <Button variant="primary" icon="add">
            New Charge
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <StatCard 
            key={stat.label} 
            label={stat.label} 
            value={stat.value} 
            trend={stat.trend}
            change={stat.change}
            icon={stat.icon} 
            iconColor={stat.iconColor} 
          />
        ))}
      </section>

      <div className="space-y-8">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-semibold text-slate-900">
              Revenue & MRR Trends
            </h3>
            <div className="text-sm text-slate-500 font-medium px-3 py-1 bg-slate-50 border border-slate-200 rounded-md">
              Last 30 Days
            </div>
          </div>
          {loading ? (
            <div className="h-[300px] w-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <RevenueChart data={historicalData} />
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">
              Recent Transactions
            </h3>
            <a href="/dashboard/transactions" className="text-sm font-medium text-[#4F46E5] hover:text-[#4338ca] transition-colors flex items-center gap-1 group">
              View all
              <span className="material-symbols-outlined text-[16px] transform group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </a>
          </div>
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-[300px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <TransactionTable 
              transactions={paginatedTransactions} 
              totalEntries={recentTransactions.length}
              page={txPage}
              onNextPage={() => setTxPage(p => p + 1)}
              onPrevPage={() => setTxPage(p => Math.max(1, p - 1))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
