import React from "react";
import { PortalProvider } from "@/context/PortalContext";
import PortalHeader from "@/components/portal/PortalHeader";

export const metadata = {
  title: "Customer Portal | FlexCharge",
  description: "Manage your subscription securely.",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <PortalHeader />
        
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 animate-in fade-in duration-500">
          {children}
        </main>

        <footer className="w-full py-8 text-center text-sm text-slate-400">
          <p>Powered by FlexCharge Billing</p>
        </footer>
      </div>
    </PortalProvider>
  );
}
