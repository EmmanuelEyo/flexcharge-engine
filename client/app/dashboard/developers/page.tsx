/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import api from "@/lib/api";

interface ApiKey {
  _id: string;
  prefix: string;
  name: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/api-keys");
      setKeys(res.data?.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    setGenerating(true);
    try {
      const res = await api.post("/auth/api-keys", { name: newKeyName });
      setNewlyGeneratedKey(res.data?.data?.rawKey);
      setNewKeyName("");
      await fetchKeys();
    } catch (err: any) {
      alert(err.message || "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key? Any integrations using it will immediately fail.")) return;
    try {
      await api.delete(`/auth/api-keys/${id}`);
      await fetchKeys();
    } catch (err: any) {
      alert(err.message || "Failed to revoke key");
    }
  };

  const copyKey = () => {
    if (!newlyGeneratedKey) return;
    navigator.clipboard.writeText(newlyGeneratedKey).catch(() => {});
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4F46E5] text-[20px] leading-none">
              key
            </span>
            API Keys
          </h3>
          <Button variant="primary" size="sm" onClick={() => setShowNewKeyModal(true)}>
            Generate New Key
          </Button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Use these keys to authenticate requests from your backend server. Keys grant full access to your production data.
          </p>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-slate-100 rounded-lg"></div>
              <div className="h-12 bg-slate-100 rounded-lg"></div>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">No active API keys found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.filter(k => k.isActive).map(key => (
                <div key={key._id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {key.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{key.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{key.prefix}**************************</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium text-slate-500">Created</p>
                      <p className="text-xs text-slate-400">{new Date(key.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => handleRevoke(key._id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-200">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      <span className="hidden sm:inline">Revoke</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewKeyModal && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {newlyGeneratedKey ? (
              <div className="p-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <span className="material-symbols-outlined text-emerald-600 text-[24px]">check</span>
                </div>
                <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Key Generated</h3>
                <p className="text-sm text-center text-red-600 font-medium mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                  Please copy this key now. For security reasons, it will never be shown again!
                </p>
                
                <div className="relative mb-6">
                  <input type="text" readOnly value={newlyGeneratedKey} className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-800 outline-none" />
                  <button onClick={copyKey} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors flex items-center justify-center ${copiedKey ? "bg-emerald-100 text-emerald-700" : "hover:bg-slate-200 text-slate-500"}`}>
                    <span className="material-symbols-outlined text-[18px]">{copiedKey ? "check" : "content_copy"}</span>
                  </button>
                </div>
                
                <Button variant="primary" className="w-full" onClick={() => { setShowNewKeyModal(false); setNewlyGeneratedKey(null); }}>
                  I have copied my key
                </Button>
              </div>
            ) : (
              <form onSubmit={handleGenerate} className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Generate API Key</h3>
                  <button type="button" onClick={() => setShowNewKeyModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded-full transition-colors">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Key Name</label>
                    <input autoFocus required type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production Server" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all placeholder:text-slate-400" />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowNewKeyModal(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" disabled={generating}>
                    {generating ? "Generating..." : "Generate Key"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function WebhookCard() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("••••••••••••••••••••");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const fetchWebhook = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, secretRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/auth/webhook-secret").catch(() => null)
      ]);
      const tenant = profileRes.data?.data;
      if (tenant?.webhookUrl) {
        setUrl(tenant.webhookUrl);
        setEnabled(true);
      }
      if (secretRes?.data?.data?.webhookSecret) {
        setSecret(secretRes.data.data.webhookSecret);
      }
    } catch (err: any) {
      console.error("Failed to load webhook config", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhook();
  }, [fetchWebhook]);

  async function handleSave() {
    setSaving(true);
    try {
      let finalUrl = "";
      if (enabled) {
        finalUrl = url;
        if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
          finalUrl = `https://${finalUrl}`;
        }
      }
      await api.patch("/auth/webhook", { webhookUrl: finalUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(err.message || "Failed to save webhook");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4F46E5] text-[20px] leading-none">
            webhook
          </span>
          Webhooks
        </h3>
        {loading ? (
          <div className="w-10 h-5 bg-slate-200 rounded-full animate-pulse"></div>
        ) : (
          <label className="relative flex items-center cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-[#4F46E5] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
          </label>
        )}
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm text-slate-500 leading-relaxed">
          Configure where FlexCharge should send asynchronous event notifications like successful payments, cancellations, or wallet top-ups.
        </p>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Webhook Endpoint URL</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-400 font-mono text-sm">https://</span>
            </div>
            <input 
              type="text" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="api.yourdomain.com/webhooks/flexcharge" 
              disabled={!enabled || loading} 
              className="w-full pl-[4.5rem] pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50" 
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Signing Secret</label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input 
                type={revealed ? "text" : "password"} 
                readOnly 
                value={loading ? "Loading..." : secret} 
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-600 focus:outline-none" 
              />
              <button 
                onClick={() => setRevealed(!revealed)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              >
                <span className="material-symbols-outlined text-[18px]">{revealed ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(secret).catch(() => {});
                alert("Signing secret copied!");
              }} 
              disabled={loading}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Use this secret to verify the HMAC signature of incoming webhooks.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving..." : saved ? (
              <>
                <span className="material-symbols-outlined text-[16px] leading-none">check</span>
                Saved!
              </>
            ) : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickReferenceCard() {
  const links = [
    { label: "Authentication Guide", href: "/dashboard/developers/docs#authentication-guide" },
    { label: "Webhook Signatures", href: "/dashboard/developers/docs#webhook-signatures" },
    { label: "Handling Retries", href: "/dashboard/developers/docs#handling-retries" },
    { label: "API Reference", href: "/dashboard/developers/docs" },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl p-6 border border-slate-200 shadow-sm">
      <h4 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
        <span className="material-symbols-outlined text-indigo-500 text-[22px] leading-none">
          menu_book
        </span>
        Quick Reference
      </h4>
      <ul className="space-y-4">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-between group transition-colors">
              {link.label}
              <span className="material-symbols-outlined text-[16px] text-indigo-400 group-hover:text-indigo-700 group-hover:translate-x-1 transition-all">
                arrow_forward
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-8 p-4 bg-white/60 backdrop-blur-sm border border-indigo-100 rounded-lg">
         <p className="text-xs text-slate-600 leading-relaxed font-medium">Need technical support? Contact our engineering team directly via the developer portal.</p>
      </div>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="border-b border-slate-200 pb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center flex-shrink-0 border border-indigo-100 shadow-sm">
          <span className="material-symbols-outlined text-[#4F46E5] text-[24px]">code</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            API Configuration
          </h2>
          <p className="text-base text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage your integration credentials and configure webhook endpoints to receive real-time event notifications.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
        <span className="material-symbols-outlined text-amber-600 text-[20px] leading-none mt-0.5 flex-shrink-0">
          security
        </span>
        <div>
          <h4 className="text-sm font-bold text-slate-900 mb-0.5">
            Security Warning
          </h4>
          <p className="text-sm text-slate-700 leading-relaxed">
            Keep your secret keys safe. Do not share them in client-side code, public repositories, or expose them to unauthorized personnel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <ApiKeysCard />
          <WebhookCard />
        </div>

        <div className="sticky top-24">
          <QuickReferenceCard />
        </div>
      </div>
    </div>
  );
}
