import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";

interface WalletDrawerProps {
  wallet: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function WalletDrawer({ wallet, onClose, onUpdate }: WalletDrawerProps) {
  const [activeTab, setActiveTab] = useState<"transactions" | "topup" | "deduct" | "settings">("transactions");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(wallet.autoTopUp?.enabled || false);
  const [threshold, setThreshold] = useState((wallet.autoTopUp?.thresholdKobo || 0) / 100);
  const [topUpAmount, setTopUpAmount] = useState((wallet.autoTopUp?.topUpAmountKobo || 0) / 100);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    }
  }, [activeTab, wallet._id]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/wallets/${wallet._id}/transactions`);
      setTransactions(res.data.data || []);
    } catch (err: any) {
      setError("Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (type: "top-up" | "deduct", e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError("");
      const amountKobo = parseFloat(amount) * 100;
      await api.post(`/wallets/${wallet._id}/${type}`, {
        amount: amountKobo,
        description: description || undefined,
      });
      setAmount("");
      setDescription("");
      onUpdate();
      setActiveTab("transactions");
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${type}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSettingsLoading(true);
      setError("");
      await api.patch(`/wallets/${wallet._id}/auto-top-up`, {
        enabled: autoTopUpEnabled,
        thresholdKobo: threshold * 100,
        topUpAmountKobo: topUpAmount * 100,
      });
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format((kobo || 0) / 100);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Wallet Details</h2>
            <p className="text-sm text-slate-500 mt-1">ID: {wallet._id.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Current Balance</p>
              <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(wallet.balance)}
              </h3>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {[
              { id: "transactions", label: "Ledger" },
              { id: "topup", label: "Top Up" },
              { id: "deduct", label: "Deduct" },
              { id: "settings", label: "Settings" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
              <span className="material-symbols-outlined mr-2 text-[18px]">error</span>
              {error}
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">No transactions yet</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                      }`}>
                        <span className="material-symbols-outlined text-[16px]">
                          {tx.type === "credit" ? "arrow_downward" : "arrow_upward"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                        <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.type === "credit" ? "text-emerald-600" : "text-slate-900"}`}>
                        {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-slate-500">{formatCurrency(tx.balanceAfter)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {(activeTab === "topup" || activeTab === "deduct") && (
            <form onSubmit={(e) => handleAction(activeTab === "topup" ? "top-up" : "deduct", e)} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (NGN)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`Reason for ${activeTab}...`}
                  />
                </div>
                <Button type="submit" disabled={actionLoading} className="w-full">
                  {actionLoading ? "Processing..." : activeTab === "topup" ? "Add Funds" : "Deduct Funds"}
                </Button>
              </div>
            </form>
          )}

          {activeTab === "settings" && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-medium text-slate-900">Auto Top-Up</h4>
                  <p className="text-xs text-slate-500">Automatically refill wallet when balance falls below threshold</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={autoTopUpEnabled} onChange={(e) => setAutoTopUpEnabled(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              
              {autoTopUpEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Threshold Balance (NGN)</label>
                    <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Top-Up Amount (NGN)</label>
                    <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              )}
              
              <div className="pt-2">
                <Button onClick={handleSaveSettings} disabled={settingsLoading} className="w-full">
                  {settingsLoading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
