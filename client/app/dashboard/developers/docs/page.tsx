"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import swaggerDoc from "./swagger.json";

// Dynamically import SwaggerUI to avoid Next.js SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false, loading: () => <p className="p-8 text-center text-slate-500">Loading API Reference...</p> });

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("authentication-guide");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden bg-slate-50 animate-in fade-in duration-500 rounded-xl border border-slate-200">
      
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto hidden md:block">
        <div className="p-5">
          <Link href="/dashboard/developers" className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-6 transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Config
          </Link>
          
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Getting Started</h3>
          <ul className="space-y-1 mb-8">
            <li>
              <button onClick={() => scrollTo("authentication-guide")} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "authentication-guide" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Authentication
              </button>
            </li>
            <li>
              <button onClick={() => scrollTo("webhook-signatures")} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "webhook-signatures" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Webhook Signatures
              </button>
            </li>
            <li>
              <button onClick={() => scrollTo("handling-retries")} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "handling-retries" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Handling Retries
              </button>
            </li>
          </ul>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">API Reference</h3>
          <ul className="space-y-1">
            <li>
              <button onClick={() => scrollTo("api-reference")} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === "api-reference" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Interactive API Docs
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 scroll-smooth bg-white">
        <div className="max-w-6xl mx-auto space-y-16 pb-24">
          
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">FlexCharge API Documentation</h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-4xl">
              Welcome to the FlexCharge API. Our API is organized around REST. Our API has predictable resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.
            </p>
          </div>

          <hr className="border-slate-200" />

          {/* Authentication Guide */}
          <section id="authentication-guide" className="space-y-6 scroll-mt-8 max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">lock</span>
              Authentication Guide
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The FlexCharge API uses API keys to authenticate requests. You can view and manage your API keys in the <Link href="/dashboard/developers" className="text-indigo-600 hover:underline">Developers Dashboard</Link>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <span className="material-symbols-outlined text-amber-600 text-[20px] leading-none mt-0.5">warning</span>
              <div>
                <p className="text-sm text-slate-800 font-medium mb-1">Keep your keys safe</p>
                <p className="text-sm text-slate-700">Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.</p>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Authentication to the API is performed via HTTP Headers. Provide your API key as the <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">x-api-key</code> header.
            </p>
            <div className="bg-slate-900 rounded-xl p-5 overflow-x-auto shadow-inner">
              <pre className="text-sm text-slate-300 font-mono">
                <code>
<span className="text-indigo-400">curl</span> https://api.flexcharge.com/v1/customers \<br/>
  -H <span className="text-emerald-400">"x-api-key: fck_live_xxxxxxxxxxxxxxxxx"</span>
                </code>
              </pre>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* Webhook Signatures */}
          <section id="webhook-signatures" className="space-y-6 scroll-mt-8 max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">webhook</span>
              Webhook Signatures
            </h2>
            <p className="text-slate-600 leading-relaxed">
              FlexCharge can send webhook events that notify your application any time an event happens on your account. To verify that the events were sent by FlexCharge and not by a third party, you should verify the webhook signatures.
            </p>
            <p className="text-slate-600 leading-relaxed">
              FlexCharge signs the webhook events it sends to your endpoints by including a signature in each event's <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">x-webhook-signature</code> header.
            </p>
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-3">Verifying Signatures</h3>
            <div className="bg-slate-900 rounded-xl p-5 overflow-x-auto shadow-inner">
              <pre className="text-sm text-slate-300 font-mono">
                <code>
<span className="text-slate-500">// Node.js Example</span><br/>
<span className="text-indigo-400">const</span> crypto = <span className="text-emerald-400">require</span>(<span className="text-amber-300">'crypto'</span>);<br/><br/>
<span className="text-indigo-400">const</span> signature = req.headers[<span className="text-amber-300">'x-webhook-signature'</span>];<br/>
<span className="text-indigo-400">const</span> payload = <span className="text-emerald-400">JSON</span>.stringify(req.body);<br/>
<span className="text-indigo-400">const</span> secret = <span className="text-amber-300">'whsec_...'</span>; <span className="text-slate-500">// Get this from your Developers Dashboard</span><br/><br/>
<span className="text-indigo-400">const</span> expectedSignature = crypto<br/>
  .createHmac(<span className="text-amber-300">'sha256'</span>, secret)<br/>
  .update(payload)<br/>
  .digest(<span className="text-amber-300">'hex'</span>);<br/><br/>
<span className="text-indigo-400">if</span> (signature === expectedSignature) {'{'}<br/>
  <span className="text-slate-500">  // Valid payload</span><br/>
{'}'}
                </code>
              </pre>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* Handling Retries */}
          <section id="handling-retries" className="space-y-6 scroll-mt-8 max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">sync</span>
              Handling Retries
            </h2>
            <p className="text-slate-600 leading-relaxed">
              When working with the API over the network, requests might occasionally fail due to timeouts or temporary network issues. We recommend configuring your API clients to automatically retry requests that fail with a <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">409 Conflict</code>, <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">429 Too Many Requests</code>, or <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">5xx</code> status code.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We implement rate limiting to ensure platform stability. If you exceed the rate limits, you will receive a <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm">429 Too Many Requests</code> response. We suggest using an exponential backoff strategy for retries to avoid further limits.
            </p>
          </section>

          <hr className="border-slate-200" />

          {/* Full Interactive API Reference */}
          <section id="api-reference" className="space-y-6 scroll-mt-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">api</span>
              Interactive API Reference
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6 max-w-4xl">
              The section below contains the complete and interactive FlexCharge API specification. You can explore all available endpoints, required parameters, and see exact response payload structures down to the last atom.
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <SwaggerUI spec={swaggerDoc} />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
