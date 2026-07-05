"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import WalletDrawer from "@/components/dashboard/WalletDrawer";

export default function WalletGroupDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  
  // Settings Form State
  const [minAmount, setMinAmount] = useState<number | "">("");
  const [maxAmount, setMaxAmount] = useState<number | "">("");
  const [minTrigger, setMinTrigger] = useState<number | "">("");
  const [maxTrigger, setMaxTrigger] = useState<number | "">("");

  // Drawer
  const [selectedWallet, setSelectedWallet] = useState<any>(null);

  // Create Wallet Modal State
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  const openWalletModal = async () => {
    setIsWalletModalOpen(true);
    try {
      const res = await api.get("/customers");
      setCustomers(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load customers");
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    try {
      setIsCreatingWallet(true);
      const res = await api.post("/wallets", { customerId: selectedCustomerId });
      const newWalletId = res.data.data._id;
      await api.patch(`/wallets/${newWalletId}/wallet-group`, { walletGroupId: groupId });
      toast.success("Wallet created and assigned to group");
      setIsWalletModalOpen(false);
      setSelectedCustomerId("");
      fetchGroupAndWallets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create wallet");
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const fetchGroupAndWallets = async () => {
    try {
      setLoading(true);
      const [groupRes, walletsRes] = await Promise.all([
        api.get(`/wallet-groups/${groupId}`),
        api.get(`/wallets?walletGroupId=${groupId}`) // Assuming the wallets list can filter by this
      ]);
      
      const g = groupRes.data.data;
      setGroup(g);
      setWallets(walletsRes.data.data || []);

      setMinAmount(g.minAutoTopUpAmount ? g.minAutoTopUpAmount / 100 : "");
      setMaxAmount(g.maxAutoTopUpAmount ? g.maxAutoTopUpAmount / 100 : "");
      setMinTrigger(g.minAutoTopUpTrigger ? g.minAutoTopUpTrigger / 100 : "");
      setMaxTrigger(g.maxAutoTopUpTrigger ? g.maxAutoTopUpTrigger / 100 : "");
    } catch (err) {
      setError("Failed to load wallet group details.");
      toast.error("Failed to load details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchGroupAndWallets();
    }
  }, [groupId]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/wallet-groups/${groupId}`, {
        minAutoTopUpAmount: minAmount !== "" ? Number(minAmount) * 100 : undefined,
        maxAutoTopUpAmount: maxAmount !== "" ? Number(maxAmount) * 100 : undefined,
        minAutoTopUpTrigger: minTrigger !== "" ? Number(minTrigger) * 100 : undefined,
        maxAutoTopUpTrigger: maxTrigger !== "" ? Number(maxTrigger) * 100 : undefined,
      });
      toast.success("Wallet group settings updated.");
      fetchGroupAndWallets();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      await api.delete(`/wallet-groups/${groupId}`);
      toast.success("Wallet group deleted.");
      router.push("/dashboard/wallet-groups");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete group");
    }
  };

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format((kobo || 0) / 100);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-center">
        <span className="material-symbols-outlined mr-2 text-[20px]">error</span>
        {error || "Group not found"}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col space-y-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
          <Link href="/dashboard/wallet-groups" className="hover:text-indigo-600 flex items-center transition-colors">
            <span className="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
            Back to Groups
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">{group.name}</h2>
              {group.isDefault && (
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold tracking-wide uppercase rounded-full">
                  Default Group
                </span>
              )}
            </div>
            <p className="text-base text-slate-500 mt-1 max-w-2xl">{group.description || "No description."}</p>
          </div>
          {!group.isDefault && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors"
            >
              Delete Group
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* SETTINGS PANEL */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
              <span className="material-symbols-outlined mr-2 text-indigo-600">settings</span>
              Boundaries Configuration
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Top-Up Amount Limits</h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Minimum (NGN)</label>
                    <input
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="No limit"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Maximum (NGN)</label>
                    <input
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="No limit"
                    />
                  </div>
                </div>

                <div className="space-y-3 md:border-l md:border-slate-100 md:pl-6">
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Balance Trigger Limits</h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Minimum (NGN)</label>
                    <input
                      type="number"
                      value={minTrigger}
                      onChange={(e) => setMinTrigger(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="No limit"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Maximum (NGN)</label>
                    <input
                      type="number"
                      value={maxTrigger}
                      onChange={(e) => setMaxTrigger(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="No limit"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition-all"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* WALLETS LIST */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <span className="material-symbols-outlined mr-2 text-indigo-600">group</span>
                Assigned Wallets ({wallets.length})
              </h3>
              <button 
                onClick={openWalletModal}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px] mr-1">add</span>
                Create Wallet
              </button>
            </div>
            
            <div className="overflow-x-auto">
              {wallets.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">inbox</span>
                  <p className="text-sm text-slate-500">No wallets are currently assigned to this group.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Balance</th>
                      <th className="px-6 py-4">Auto Top-Up</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wallets.map((w: any) => (
                      <tr key={w._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">
                            {w.customerId?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{w._id.slice(-8)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-md text-sm">
                            {formatCurrency(w.balance)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {w.autoTopUp ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Off
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedWallet(w)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedWallet && (
        <WalletDrawer
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
          onUpdate={fetchGroupAndWallets}
        />
      )}

      {/* CREATE WALLET MODAL */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Provision Wallet</h2>
              <button onClick={() => setIsWalletModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Customer</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                  <option value="" disabled>Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name || "Unknown"} ({c.email})</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  The wallet will automatically be assigned to the current group boundaries upon creation.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWallet || !selectedCustomerId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isCreatingWallet ? "Provisioning..." : "Provision Wallet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
