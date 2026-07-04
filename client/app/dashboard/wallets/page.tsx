"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import WalletDrawer from "@/components/dashboard/WalletDrawer";

interface Customer {
  _id: string;
  name: string;
  email: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedWallet, setSelectedWallet] = useState<any | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/wallets");
      setWallets(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    setIsCreateModalOpen(true);
    try {
      const res = await api.get("/customers");
      setCustomers(res.data.data || []);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      setCreateLoading(true);
      await api.post("/wallets", { customerId: selectedCustomer });
      setIsCreateModalOpen(false);
      setSelectedCustomer("");
      fetchWallets();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create wallet");
    } finally {
      setCreateLoading(false);
    }
  };

  const formatCurrency = (kobo: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format((kobo || 0) / 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Customer Wallets</h2>
          <p className="text-base text-slate-500 mt-1">
            Manage prepaid credit balances and auto-top-up settings for your customers.
          </p>
        </div>
        <Button onClick={openCreateModal}>New Wallet</Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center border border-red-100">
          <span className="material-symbols-outlined mr-2">error</span>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Customer / Wallet ID</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-right">Balance</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider">Auto Top-Up</th>
                  <th className="py-4 px-6 font-semibold text-sm text-slate-500 uppercase tracking-wider text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wallets.length > 0 ? (
                  wallets.map((wallet) => (
                    <tr 
                      key={wallet._id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedWallet(wallet)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            W
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {wallet.customerId ? wallet.customerId.slice(-6).toUpperCase() : "UNKNOWN"}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{wallet._id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-right font-bold text-slate-900">
                        {formatCurrency(wallet.balance)}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {wallet.autoTopUp?.enabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-right text-slate-500">
                        {new Date(wallet.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 px-6 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                        <span className="material-symbols-outlined text-[32px]">account_balance_wallet</span>
                      </div>
                      <p className="text-lg font-medium text-slate-900">No wallets found</p>
                      <p className="text-slate-500 mb-4 mt-1">Create a wallet to manage customer credits.</p>
                      <Button variant="secondary" onClick={openCreateModal}>Create Wallet</Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedWallet && (
        <WalletDrawer 
          wallet={selectedWallet} 
          onClose={() => setSelectedWallet(null)} 
          onUpdate={() => {
            fetchWallets();
            // Refetch the selected wallet to update drawer state
            api.get(`/wallets/${selectedWallet._id}`).then(res => {
              if(res.data.data) setSelectedWallet(res.data.data);
            });
          }} 
        />
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-900">Create Wallet</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateWallet}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Customer</label>
                  <select 
                    value={selectedCustomer} 
                    onChange={e => setSelectedCustomer(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    <option value="" disabled>Select a customer...</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} type="button">Cancel</Button>
                <Button type="submit" disabled={createLoading || !selectedCustomer}>
                  {createLoading ? "Creating..." : "Create Wallet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
