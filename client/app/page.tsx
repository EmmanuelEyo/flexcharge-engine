"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Checking for the custom token used in login/register pages
    const token = typeof window !== "undefined" ? sessionStorage.getItem("fc_token") : null;
    
    if (token) {
      router.push("/dashboard");
    } else {
      router.push("/register");
    }
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background overflow-hidden relative">
      {/* Dynamic background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="z-10 flex flex-col items-center space-y-8 p-8 backdrop-blur-md bg-surface/50 rounded-3xl shadow-2xl border border-outline-variant/30">
        <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-tr from-primary to-tertiary shadow-xl shadow-primary/30">
          <Zap className="w-12 h-12 text-on-primary animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white/80 animate-spin" style={{ animationDuration: '1.5s' }} />
          <div className="absolute -inset-2 rounded-full border-4 border-transparent border-b-primary/50 animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }} />
        </div>
        
        <div className="flex flex-col items-center space-y-3">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-tertiary">
            FlexCharge
          </h1>
          <div className="flex items-center space-x-3 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-base font-medium tracking-wide animate-pulse">
              Authenticating...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
