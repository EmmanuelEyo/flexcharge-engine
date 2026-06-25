import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ children, className = "", noPadding = false }: CardProps) {
  return (
    <div className={["rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm", noPadding ? "" : "p-6", className,].join(" ")}>
      {children}
    </div>
  );
}
