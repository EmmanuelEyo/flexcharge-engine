"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import StatCard from "@/components/dashboard/StatCard";
import Select from "@/components/ui/Select";
import toast from "react-hot-toast";

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

interface PayoutSettings {
  payoutSchedule: "daily" | "weekly" | "monthly";
  payoutThreshold: number;
  payoutDayOfWeek?: number;
  payoutDayOfMonth?: number;
}

export default function LedgerPage() {
  const [data, setData] = useState<LedgerBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankLoading, setBankLoading] = useState(false);
  const [banks, setBanks] = useState<{ value: string; label: string }[]>([]);

  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({
    payoutSchedule: "weekly",
    payoutThreshold: 500000,
    payoutDayOfWeek: 1,
    payoutDayOfMonth: 1,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ledger/dashboard/balance");
      setData(res.data.data);

      const profileRes = await api.get("/auth/me");
      if (profileRes.data.data) {
         const tenant = profileRes.data.data;
         setPayoutSettings({
           payoutSchedule: tenant.payoutSchedule || "weekly",
           payoutThreshold: tenant.payoutThreshold !== undefined ? tenant.payoutThreshold : 500000,
           payoutDayOfWeek: tenant.payoutDayOfWeek || 1,
           payoutDayOfMonth: tenant.payoutDayOfMonth || 1,
         });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await api.get("/ledger/dashboard/banks");
      if (res.data.data) {
        setBanks(
          res.data.data.map((b: any) => ({
            value: b.code,
            label: b.name,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch banks", err);
    }
  };

  const handleOpenBankModal = () => {
    setIsBankModalOpen(true);
    if (banks.length === 0) {
      fetchBanks();
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
      toast.success("Bank account configured successfully!");
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Failed to configure bank account";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setBankLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSettingsLoading(true);
      setError("");
      await api.patch("/auth/payout-settings", payoutSettings);
      fetchLedger();
      toast.success("Payout settings saved successfully!");
    } catch (err: any) {
      const errMsg = err.response?.data?.error || "Failed to save payout settings";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSettingsLoading(false);
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
          <Button variant="secondary" onClick={handleOpenBankModal}>
            {data?.settlementAccount ? "Update Bank Account" : "Configure Bank Account"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center border border-red-100">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

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

      {/* Payout Schedule Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Estimator Panel */}
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-2xl shadow-lg border border-indigo-800 p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
          <div>
            <div className="flex items-center gap-3 mb-6">
               <span className="material-symbols-outlined text-[28px] text-indigo-300">calendar_clock</span>
               <h3 className="text-xl font-bold tracking-tight text-white">Upcoming Payout Estimator</h3>
            </div>
            
            <div className="space-y-4">
               <div>
                  <p className="text-sm text-indigo-200 font-medium">Next Scheduled Payday</p>
                  <p className="text-2xl font-semibold mt-1">
                    {payoutSettings.payoutSchedule === "daily" ? "Every Day" : 
                     payoutSettings.payoutSchedule === "weekly" ? `Every ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][payoutSettings.payoutDayOfWeek! - 1] || "Monday"}` :
                     `Every ${payoutSettings.payoutDayOfMonth}th of the month`}
                  </p>
               </div>
               
               <div className="flex justify-between items-end pb-2 border-b border-indigo-800/50 pt-2">
                  <div>
                    <p className="text-sm text-indigo-200 font-medium mb-1">Transfer Threshold</p>
                    <p className="text-lg text-indigo-100">{formatCurrency(payoutSettings.payoutThreshold)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-indigo-200 font-medium mb-1 text-right">Current Balance</p>
                    <p className="text-xl font-bold text-emerald-400">{data ? formatCurrency(data.availableBalance) : "₦0.00"}</p>
                  </div>
               </div>
               
               <div className="pt-2">
                 <p className="text-sm font-medium mt-2">
                   {data && data.availableBalance >= payoutSettings.payoutThreshold ? (
                      <span className="text-emerald-400 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">check_circle</span> Meets threshold. Will payout on next payday.</span>
                   ) : (
                      <span className="text-amber-400 flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">warning</span> Below threshold. Will roll over until met.</span>
                   )}
                 </p>
               </div>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
           <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-6">Automated Payout Settings</h3>
           
           {!data?.settlementAccount && (
             <div className="mb-5 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl flex items-start gap-2.5">
               <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">warning</span>
               <span>Please configure your settlement bank account above to unlock automated payout schedules.</span>
             </div>
           )}

           <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">Payout Schedule</label>
                 <Select 
                   value={payoutSettings.payoutSchedule}
                   onChange={(val) => setPayoutSettings({...payoutSettings, payoutSchedule: val})}
                   disabled={!data?.settlementAccount}
                   options={[
                     { value: "daily", label: "Daily" },
                     { value: "weekly", label: "Weekly" },
                     { value: "monthly", label: "Monthly" }
                   ]}
                 />
              </div>

              {payoutSettings.payoutSchedule === "weekly" && (
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Day of the Week</label>
                   <Select 
                     value={payoutSettings.payoutDayOfWeek}
                     onChange={(val) => setPayoutSettings({...payoutSettings, payoutDayOfWeek: Number(val)})}
                     disabled={!data?.settlementAccount}
                     options={[
                       { value: 1, label: "Monday" },
                       { value: 2, label: "Tuesday" },
                       { value: 3, label: "Wednesday" },
                       { value: 4, label: "Thursday" },
                       { value: 5, label: "Friday" },
                       { value: 6, label: "Saturday" },
                       { value: 7, label: "Sunday" }
                     ]}
                   />
                </div>
              )}

              {payoutSettings.payoutSchedule === "monthly" && (
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">Day of the Month</label>
                   <input
                     type="number"
                     min="1"
                     max="31"
                     value={payoutSettings.payoutDayOfMonth}
                     onChange={(e) => setPayoutSettings({...payoutSettings, payoutDayOfMonth: parseInt(e.target.value)})}
                     disabled={!data?.settlementAccount}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all disabled:opacity-60"
                   />
                </div>
              )}

              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Payout Threshold (NGN)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₦</span>
                   <input
                     type="number"
                     min="0"
                     step="0.01"
                     value={payoutSettings.payoutThreshold / 100}
                     onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                           setPayoutSettings({...payoutSettings, payoutThreshold: val * 100});
                        }
                     }}
                     disabled={!data?.settlementAccount}
                     className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all disabled:opacity-60"
                   />
                 </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={settingsLoading || !data?.settlementAccount} className="w-full justify-center">
                  {settingsLoading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
           </form>
        </div>
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
            <Button variant="secondary" onClick={handleOpenBankModal}>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank</label>
                  <Select
                    value={bankCode}
                    onChange={(val) => setBankCode(val)}
                    options={banks}
                    placeholder={banks.length === 0 ? "Loading banks..." : "Select a bank"}
                    searchable={true}
                  />
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

    </div>
  );
}
