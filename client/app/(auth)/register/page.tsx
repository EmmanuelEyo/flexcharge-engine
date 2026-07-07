"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/ui/LogoIcon";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { registerTenant } from "@/lib/auth";

interface FormState {
  email: string;
  company: string;
  password: string;
}

interface FormErrors {
  email?: string;
  company?: string;
  password?: string;
  form?: string;
}


function validate(values: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!values.email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.company.trim()) {
    errors.company = "Business name is required.";
  } else if (values.company.trim().length < 2) {
    errors.company = "Business name must be at least 2 characters.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}


export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState<FormState>({
    email: "",
    company: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...values, [field]: e.target.value };
      setValues(next);
      if (touched[field]) {
        const nextErrors = validate(next);
        setErrors((prev) => ({ ...prev, [field]: nextErrors[field] }));
      }
    };
  }

  function handleBlur(field: keyof FormState) {
    return () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const nextErrors = validate(values);
      setErrors((prev) => ({ ...prev, [field]: nextErrors[field] }));
    };
  }


  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ email: true, company: true, password: true });

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        const response = await registerTenant({
          name: values.company.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });

        if (!response.success) {
          setErrors({ form: "Registration failed. Please try again." });
          return;
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("fc_token", response.data.token);
          localStorage.setItem("fc_user", JSON.stringify(response.data.tenant));
        }
        router.replace("/dashboard");
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
        setErrors({ form: message });
      }
    });
  }

  const isLoading = isPending;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <div className="text-2xl font-bold text-primary flex items-center justify-center lg:justify-start gap-2 mb-8">
          <LogoIcon className="w-8 h-8 text-primary" />
          FlexCharge
        </div>

        <h2 className="text-[24px] leading-[32px] tracking-[-0.01em] font-semibold text-on-surface">
          Create your account
        </h2>
        <p className="text-base leading-6 text-on-surface-variant">
          Start powering your business payments today.
        </p>
      </div>

      {errors.form && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3">
          <span className="material-symbols-outlined text-error text-[20px] mt-px flex-shrink-0">
            error
          </span>
          <p className="text-sm text-error">{errors.form}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-8" noValidate>
        <Input id="email" name="email" type="email" label="Email Address" placeholder="admin@yourcompany.com" icon="mail" autoComplete="email" value={values.email} onChange={handleChange("email")} onBlur={handleBlur("email")} error={errors.email} disabled={isLoading} required />
        <Input id="company" name="company" type="text" label="Business Name" placeholder="Acme Corp" icon="domain" autoComplete="organization" value={values.company} onChange={handleChange("company")} onBlur={handleBlur("company")} error={errors.company} disabled={isLoading} required />
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant">
            Password
          </label>
          <div className={`relative rounded-lg shadow-sm input-glow border transition-all duration-200 ${errors.password ? "border-error" : "border-outline-variant"}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline text-[20px]">
                lock
              </span>
            </div>
            <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" value={values.password} onChange={handleChange("password")} onBlur={handleBlur("password")} disabled={isLoading} required className="block w-full pl-10 pr-10 py-2 rounded-lg bg-surface text-on-surface text-sm placeholder:text-outline focus:outline-none disabled:opacity-50" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors" aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-error">{errors.password}</p>
          )}
        </div>

        <div className="flex items-center pt-2">
          <input id="terms" name="terms" type="checkbox" required disabled={isLoading} className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" />
          <label htmlFor="terms" className="ml-2 block text-sm text-on-surface-variant">
            I agree to the{" "}
            <Link href="#" className="text-primary hover:text-primary-container font-medium transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-primary hover:text-primary-container font-medium transition-colors">
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" className="w-full justify-center py-3" isLoading={isLoading} disabled={isLoading}>
            {isLoading ? "Creating account…" : "Create Account"}
          </Button>
        </div>
      </form>

      <p className="text-center text-sm text-on-surface-variant mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-container transition-colors">
          Log in
        </Link>
      </p>
    </div>
  );
}