/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PortalEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      localStorage.setItem("fc_portal_token", token);
      // Wait a moment for UX purposes before redirecting
      setTimeout(() => {
        router.replace("/portal/dashboard");
      }, 500);
    } else {
      const storedToken = localStorage.getItem("fc_portal_token");
      if (storedToken) {
        router.replace("/portal/dashboard");
      } else {
        setError("Invalid or missing session token. Please request a new portal link.");
      }
    }
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[32px]">error</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  // Loading state while processing token
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
      <p className="text-slate-600 font-medium">Authenticating your secure session...</p>
    </div>
  );
}

export default function PortalEntry() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
        <p className="text-slate-600 font-medium">Authenticating your secure session...</p>
      </div>
    }>
      <PortalEntryContent />
    </Suspense>
  );
}
