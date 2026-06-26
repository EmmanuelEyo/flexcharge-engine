import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  hover?: boolean;
}

export default function Card({ children, className = "", noPadding = false, hover = false, }: CardProps) {
  return (
    <div className={["rounded-xl border border-slate-200 bg-white shadow-sm relative overflow-hidden", noPadding ? "" : "p-4", hover ? "group hover:shadow-md transition-shadow" : "", className,].join(" ")}>
      {children}
    </div>
  );
}
