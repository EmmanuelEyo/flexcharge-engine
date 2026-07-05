"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface WalletGroup {
  _id: string;
  name: string;
  description: string;
  isDefault: boolean;
  minAutoTopUpAmount?: number;
  maxAutoTopUpAmount?: number;
}

export default function WalletGroupsPage() {
  const [groups, setGroups] = useState<WalletGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/wallet-groups");
      setGroups(res.data.data);
    } catch (err) {
      setError("Failed to load wallet groups.");
      toast.error("Failed to load wallet groups.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/wallet-groups", {
        name: newGroupName,
        description: newGroupDesc,
        isDefault,
      });
      toast.success("Wallet group created successfully");
      setIsModalOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setIsDefault(false);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create group");
    }
  };

  const formatCurrency = (kobo?: number) => {
    if (!kobo) return "No limit";
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Wallet Groups
          </h2>
          <p className="text-base text-slate-500 mt-1">
            Manage policies and top-up boundaries for your customers' wallets.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm hover:shadow transition-all"
        >
          <span className="material-symbols-outlined text-[20px] mr-2">add</span>
          Create Group
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center">
          <span className="material-symbols-outlined mr-2 text-[20px]">error</span>
          {error}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-4 block">account_balance_wallet</span>
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Wallet Groups</h3>
          <p className="text-slate-500">Create your first wallet group to start managing boundaries.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Link
              key={group._id}
              href={`/dashboard/wallet-groups/${group._id}`}
              className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden"
            >
              {group.isDefault && (
                <div className="absolute top-4 right-4 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold tracking-wide uppercase rounded-full">
                  Default
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors pr-16 truncate">
                {group.name}
              </h3>
              <p className="text-sm text-slate-500 mt-2 line-clamp-2 min-h-[40px]">
                {group.description || "No description provided."}
              </p>
              
              <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Min Top-up</p>
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(group.minAutoTopUpAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Max Top-up</p>
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(group.maxAutoTopUpAmount)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Create Wallet Group</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g. Premium Tier"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                  placeholder="What is this group for?"
                  rows={3}
                />
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Set as Default Group for new wallets</span>
              </label>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
