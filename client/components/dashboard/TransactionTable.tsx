"use client";

import React from "react";

export type TransactionStatus = "Paid" | "Failed" | "Pending";

export interface Transaction {
  id: string;
  customer: string;
  avatarUrl?: string;
  plan: string;
  amount: string;
  status: TransactionStatus;
  date: string;
}

interface TransactionTableProps {
  transactions?: Transaction[];
  totalEntries?: number;
  page?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
}

const STATUS_STYLES: Record<TransactionStatus, string> = {
  Paid: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  Failed: "bg-red-50 text-red-700 border border-red-100",
  Pending: "bg-slate-100 text-slate-600 border border-slate-200",
};

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    customer: "Adekunle Gold",
    avatarUrl: "",
    plan: "Pro Plan",
    amount: "₦25,000",
    status: "Paid",
    date: "Oct 24, 2023",
  },
  {
    id: "2",
    customer: "Sarah Jenkins",
    avatarUrl: "",
    plan: "Basic Plan",
    amount: "₦5,000",
    status: "Failed",
    date: "Oct 23, 2023",
  },
  {
    id: "3",
    customer: "Michael Chen",
    avatarUrl: "",
    plan: "Enterprise",
    amount: "₦150,000",
    status: "Pending",
    date: "Oct 23, 2023",
  },
  {
    id: "4",
    customer: "Amara Okafor",
    avatarUrl: "",
    plan: "Pro Plan",
    amount: "₦25,000",
    status: "Paid",
    date: "Oct 22, 2023",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AvatarCell({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs font-semibold text-slate-600">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>
      <span className="font-medium text-slate-900">{name}</span>
    </div>
  );
}

export default function TransactionTable({
  transactions = MOCK_TRANSACTIONS,
  totalEntries = 24,
  page = 1,
  onPrevPage,
  onNextPage,
}: TransactionTableProps) {
  const perPage = transactions.length;
  const from = (page - 1) * perPage + 1;
  const to = from + perPage - 1;
  const isFirstPage = page === 1;
  const isLastPage = to >= totalEntries;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {["Customer", "Plan", "Amount", "Status", "Date", ""].map(
                (h, i) => (
                  <th key={i} className={`py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === "" ? "text-right" : ""}`}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="py-4 px-6">
                    <AvatarCell name={tx.customer} avatarUrl={tx.avatarUrl} />
                  </td>
                  <td className="py-4 px-6 text-slate-600">{tx.plan}</td>
                  <td className="py-4 px-6 font-medium text-slate-900">
                    {tx.amount}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[tx.status]}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-500">{tx.date}</td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-slate-400 hover:text-[#4F46E5] transition-colors p-1 rounded-full hover:bg-indigo-50 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      <span className="material-symbols-outlined text-[20px] leading-none">
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

      <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {from} to {Math.min(to, totalEntries)} of {totalEntries}{" "}
          entries
        </p>
        <div className="flex gap-2">
          <button onClick={onPrevPage} disabled={isFirstPage} className="px-3 py-1 border border-slate-200 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-colors">
            Previous
          </button>
          <button onClick={onNextPage} disabled={isLastPage} className="px-3 py-1 border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
