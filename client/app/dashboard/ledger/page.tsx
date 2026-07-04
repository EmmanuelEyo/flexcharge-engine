"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import StatCard from "@/components/dashboard/StatCard";

interface LedgerBalance {
  availableBalance: number;
  totalWithdrawn: number;
  settlementAccount?: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
  recentTransactions: any[];
}

export default function LedgerPage() {
  const [data, setData] = useState<LedgerBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankLoading, setBankLoading] = useState(false);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ledger/dashboard/balance");
      setData(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  const handleSetBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBankLoading(true);
      setError("");
      await api.post("/ledger/dashboard/bank-account", { bankCode, accountNumber });
      setIsBankModalOpen(false);
      fetchLedger();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to configure bank account");
    } finally {
      setBankLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setWithdrawLoading(true);
      setError("");
      // amount is in kobo for backend, so multiply by 100
      const amount = parseFloat(withdrawAmount) * 100;
      await api.post("/ledger/dashboard/withdraw", { amount });
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      fetchLedger();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to request withdrawal");
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(kobo / 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Settlement Ledger</h2>
          <p className="text-base text-slate-500 mt-1">
            Manage your accrued balance and request payouts to your bank account.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setIsBankModalOpen(true)}>
            {data?.settlementAccount ? "Update Bank Account" : "Configure Bank Account"}
          </Button>
          <Button
            onClick={() => setIsWithdrawModalOpen(true)}
            disabled={!data?.settlementAccount || data?.availableBalance === 0}
          >
            Request Payout
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center border border-red-100">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          label="Available Balance"
          value={data ? formatCurrency(data.availableBalance) : "₦0.00"}
          icon="account_balance_wallet"
          iconColor="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Total Withdrawn"
          value={data ? formatCurrency(data.totalWithdrawn) : "₦0.00"}
          icon="payments"
          iconColor="bg-indigo-100 text-indigo-700"
        />
      </div>

      {/* Bank Account Info */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-4">Settlement Destination</h2>
        {data?.settlementAccount ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-[24px]">account_balance</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Bank Account</p>
                <p className="text-lg font-bold text-slate-900">
                  {data.settlementAccount.accountName}
                </p>
                <p className="text-sm text-slate-500">
                  {data.settlementAccount.accountNumber} • Bank Code: {data.settlementAccount.bankCode}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              Active
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 border-dashed shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mx-auto mb-3">
              <span className="material-symbols-outlined text-[24px]">account_balance</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No bank account configured</h3>
            <p className="text-slate-500 mb-4">You need to set up a settlement account to request payouts.</p>
            <Button variant="secondary" onClick={() => setIsBankModalOpen(true)}>
              Configure Now
            </Button>
          </div>
        )}
      </div>

      {/* Recent Ledger Transactions */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-4">Ledger Transactions</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-right">Amount</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                  data.recentTransactions.map((tx) => {
                    const isCredit = tx.type.toLowerCase() === "credit";
                    return (
                      <tr key={tx._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 text-sm text-slate-600">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              isCredit
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-red-50 text-red-700 border border-red-100"
                            }`}
                          >
                            {isCredit ? "Credit" : "Debit"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-900">
                          {tx.description}
                          {tx.reference && <span className="block text-xs text-slate-400 mt-0.5">{tx.reference}</span>}
                        </td>
                        <td className="py-4 px-6 text-sm text-right font-medium">
                          <span className={isCredit ? "text-emerald-600" : "text-slate-900"}>
                            {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${
                              tx.status === "SUCCESS"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : tx.status === "PENDING"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {tx.status ? tx.status.charAt(0).toUpperCase() + tx.status.slice(1).toLowerCase() : "Success"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-slate-500">
                      No ledger transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bank Account Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsBankModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-900">Configure Bank Account</h3>
              <button
                onClick={() => setIsBankModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSetBank}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Code</label>
                  <input
                    type="text"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    required
                    placeholder="e.g. 058 (GTBank)"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Use Nomba sandbox bank codes (e.g. 058 for GTBank, 033 for UBA).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    placeholder="10-digit account number"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setIsBankModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" disabled={bankLoading}>
                  {bankLoading ? "Verifying..." : "Save Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsWithdrawModalOpen(false)}
          ></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-900">Request Payout</h3>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleWithdraw}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (NGN)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₦</span>
                    <input
                      type="number"
                      min="100"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Available balance: {data ? formatCurrency(data.availableBalance) : "₦0.00"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setIsWithdrawModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button type="submit" disabled={withdrawLoading}>
                  {withdrawLoading ? "Processing..." : "Request Payout"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
