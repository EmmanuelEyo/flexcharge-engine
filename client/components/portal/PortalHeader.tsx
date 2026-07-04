"use client";

import React from "react";
import { usePortal } from "@/context/PortalContext";

export default function PortalHeader() {
  const { customer, loading } = usePortal();

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md bg-white/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-white text-[20px]">
              bolt
            </span>
          </div>
          <span className="font-semibold text-slate-900 tracking-tight">
            {loading ? "Loading..." : customer?.tenantId?.name ? `${customer.tenantId.name} Portal` : "FlexCharge Portal"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
          <span className="material-symbols-outlined text-[20px]">lock</span>
          Secure Session
        </div>
      </div>
    </header>
  );
}
