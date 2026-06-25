import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-primary-container text-on-primary hover:bg-primary focus:ring-primary border border-transparent",
  secondary:
    "bg-surface text-on-surface border border-outline-variant hover:bg-surface-container focus:ring-primary",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container focus:ring-primary border border-transparent",
  danger:
    "bg-error text-on-error hover:opacity-90 focus:ring-error border border-transparent",
};

const sizeStyles: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm font-medium",
  lg: "px-4 py-3 text-sm font-medium",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={[
        "inline-flex items-center justify-center rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
      {...props}
    >
      {isLoading ? (
        <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
