"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0f172a", // bg-slate-900
            color: "#ffffff", // text-white
            fontSize: "0.75rem", // text-xs
            fontWeight: 500, // font-medium
            borderRadius: "0.5rem", // rounded-lg
            padding: "0.625rem 1rem", // px-4 py-2.5
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)", // shadow-lg
            border: "none",
          },
          success: {
            iconTheme: {
              primary: "#34d399", // text-emerald-400
              secondary: "#0f172a",
            },
          },
          error: {
            iconTheme: {
              primary: "#f87171", // text-red-400
              secondary: "#0f172a",
            },
          },
        }}
      />
    </SessionProvider>
  );
}
