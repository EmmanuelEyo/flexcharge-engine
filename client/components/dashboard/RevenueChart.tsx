"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Snapshot {
  date: string;
  mrr: number;
  dailyRevenue: number;
}

interface RevenueChartProps {
  data: Snapshot[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value / 100);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
        No historical data available.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            tickFormatter={(val) => `₦${(val / 100 / 1000)}k`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748B", fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: any, name: any) => [
              formatCurrency(Number(value) || 0), 
              name === "mrr" ? "MRR" : "Daily Revenue"
            ]}
            labelFormatter={(label) => formatDate(label)}
            contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Area 
            type="monotone" 
            dataKey="mrr" 
            stroke="#4F46E5" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorMrr)" 
            name="mrr"
          />
          <Area 
            type="monotone" 
            dataKey="dailyRevenue" 
            stroke="#10B981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorRev)" 
            name="dailyRevenue"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
