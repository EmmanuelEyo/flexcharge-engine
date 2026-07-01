"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function CheckoutSuccessPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 mb-8">
          Thank you for subscribing. Your account has been provisioned and your invoice has been sent to your email.
        </p>

        <div className="space-y-4">
          <Link 
            href="/portal" 
            className="block w-full py-3.5 px-4 rounded-lg bg-[#4F46E5] hover:bg-[#4338ca] text-white font-semibold transition-colors"
          >
            Go to Customer Portal
          </Link>
          <p className="text-sm text-slate-400">
            Powered by FlexCharge
          </p>
        </div>
      </div>
    </div>
  );
}
