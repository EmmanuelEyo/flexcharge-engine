"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <div className="text-2xl font-bold text-primary flex items-center justify-center lg:justify-start gap-2 mb-8">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            bolt
          </span>
          FlexCharge
        </div>

        <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface">
          Welcome back
        </h2>
        <p className="text-base leading-6 text-on-surface-variant">
          Sign in to your FlexCharge account
        </p>
      </div>

      <form action="#" method="POST" className="space-y-4 mt-8">
        <Input id="email" name="email" type="email" label="Email Address" placeholder="you@example.com" icon="mail" autoComplete="email" required />

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant">Password</label>
          <div className="relative rounded-lg shadow-sm input-glow border border-outline-variant transition-all duration-200">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
            </div>
            <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" required className="block w-full pl-10 pr-10 py-2 rounded-lg bg-surface text-on-surface text-sm placeholder:text-outline focus:outline-none" />
            <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors" aria-label={showPassword ? "Hide password" : "Show password"}>
              <span className="material-symbols-outlined text-[20px]"> {showPassword ? "visibility_off" : "visibility"} </span>
            </button>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" className="w-full justify-center py-3">
            Sign In
          </Button>
        </div>
      </form>

      <p className="text-center text-sm text-on-surface-variant mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:text-primary-container transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}
