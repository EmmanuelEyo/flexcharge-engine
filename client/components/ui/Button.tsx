import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: string;
  iconPosition?: "left" | "right";
}

const variantStyles: Record<string, string> = {
  primary: "bg-[#4F46E5] text-white hover:bg-[#4338ca] border border-transparent shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-container border border-transparent",
  danger: "bg-error text-on-error hover:opacity-90 border border-transparent",
};

const sizeStyles: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm font-medium gap-2",
  lg: "px-5 py-2.5 text-sm font-medium gap-2",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  iconPosition = "left",
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const iconEl = icon ? (
    <span className="material-symbols-outlined text-[18px] leading-none">{icon}</span>
  ) : null;

  return (
    <button disabled={disabled || isLoading} className={["inline-flex items-center justify-center rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed", variantStyles[variant], sizeStyles[size], className,].join(" ")} {...props}>
      {isLoading ? (
        <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        iconPosition === "left" && iconEl
      )}
      {children}
      {!isLoading && iconPosition === "right" && iconEl}
    </button>
  );
}
