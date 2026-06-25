import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string; // Material Symbol name e.g. "person"
}

export default function Input({
  label,
  error,
  hint,
  icon,
  id,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-on-surface-variant"
        >
          {label}
        </label>
      )}
      <div className={`relative rounded-lg shadow-sm input-glow border transition-all duration-200 ${error ? "border-error" : "border-outline-variant"}`}>
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-outline text-[20px]">{icon}</span>
          </div>
        )}
        <input
          id={id}
          className={[
            "block w-full py-2 pr-3 rounded-lg bg-surface text-on-surface text-sm placeholder:text-outline focus:outline-none",
            icon ? "pl-10" : "pl-3",
            className,
          ].join(" ")}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-on-surface-variant/60">{hint}</p>
      )}
    </div>
  );
}
