"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";

function ApiKeyCard() {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rolling, setRolling] = useState(false);

  const secretKey = "sk_live_********************************";

  function handleCopy() {
    navigator.clipboard.writeText(secretKey).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRoll() {
    setRolling(true);
    setTimeout(() => setRolling(false), 600);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-base font-semibold text-slate-900">
          Live Secret Key
        </h3>
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded uppercase tracking-wider border border-indigo-100">
          Production
        </span>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          Use this key to authenticate requests from your backend server. It
          grants full access to your production data.
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#4F46E5]/20 transition-all">
            <span className="material-symbols-outlined text-slate-400 text-[18px] leading-none mr-2 flex-shrink-0">
              key
            </span>
            <input readOnly type={revealed ? "text" : "password"} value={secretKey} className="bg-transparent border-none focus:ring-0 p-0 w-full font-mono text-sm text-slate-800 tracking-wider focus:outline-none" aria-label="Secret key" />
          </div>
          <button onClick={() => setRevealed((v) => !v)} aria-label={revealed ? "Hide key" : "Reveal key"} className="p-3 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#4F46E5] hover:border-[#4F46E5] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] leading-none">
              {revealed ? "visibility_off" : "visibility"}
            </span>
          </button>

          <button onClick={handleCopy} aria-label="Copy key" className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium flex-shrink-0 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/50 ${copied ? "bg-emerald-600 text-white" : "bg-[#4F46E5] text-white hover:bg-[#4338ca]"}`}>
            <span className="material-symbols-outlined text-[18px] leading-none">
              {copied ? "check" : "content_copy"}
            </span>
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        <div className="pt-2">
          <button onClick={handleRoll} className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors focus:outline-none group">
            <span className={`material-symbols-outlined text-[18px] leading-none transition-transform duration-500 ${rolling ? "rotate-180" : ""} group-hover:rotate-180`}>
              sync
            </span>
            Roll Key
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, id, }: {
  checked: boolean; onChange: (v: boolean) => void; id: string;
}) {
  return (
    <label htmlFor={id} className="relative flex items-center cursor-pointer">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-[#4F46E5] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white" />
    </label>
  );
}

function WebhookCard() {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("api.nomba.corp/hooks/flexcharge");
  const [testSent, setTestSent] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleTest() {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4F46E5] text-[20px] leading-none">
            webhook
          </span>
          Webhooks
        </h3>
        <ToggleSwitch id="webhookToggle" checked={enabled} onChange={setEnabled} />
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          Configure where FlexCharge should send asynchronous event
          notifications (like successful payments or disputes).
        </p>

        <div className="space-y-1.5">
          <label htmlFor="webhookUrl" className="block text-sm font-medium text-slate-600">Webhook Endpoint URL</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-slate-400 font-mono text-sm">https://</span>
            </div>
            <input id="webhookUrl" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="api.yourdomain.com/webhooks/flexcharge" disabled={!enabled} className="w-full pl-[4.5rem] pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20 transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={handleTest} disabled={!enabled}>
            {testSent ? (
              <>
                <span className="material-symbols-outlined text-[16px] leading-none text-emerald-600">
                  check_circle
                </span>
                Sent!
              </>
            ) : (
              "Send Test Event"
            )}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!enabled}>
            {saved ? (
              <>
                <span className="material-symbols-outlined text-[16px] leading-none">
                  check
                </span>
                Saved!
              </>
            ) : (
              "Save Endpoint"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickReferenceCard() {
  const links = [
    { label: "Authentication Guide", href: "#" },
    { label: "Webhook Signatures", href: "#" },
    { label: "Handling Retries", href: "#" },
  ];

  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-slate-500 text-[20px] leading-none">
          menu_book
        </span>
        Quick Reference
      </h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href} className="text-sm text-[#4F46E5] hover:text-[#4338ca] hover:underline flex items-center gap-1 transition-colors">
              {link.label}
              <span className="material-symbols-outlined text-[14px] leading-none">
                open_in_new
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          API Configuration
        </h2>
        <p className="text-base text-slate-500 mt-1 max-w-2xl leading-relaxed">
          Manage your integration credentials and configure webhook endpoints to
          receive real-time event notifications.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 text-[20px] leading-none mt-0.5 flex-shrink-0">
          warning
        </span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-0.5">
            Security Warning
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            Keep your secret keys safe. Do not share them in client-side code,
            public repositories, or expose them to unauthorized personnel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <ApiKeyCard />
          <WebhookCard />
        </div>

        <div>
          <QuickReferenceCard />
        </div>
      </div>
    </div>
  );
}
