import React from "react";

interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning" | "info";
}

export function KpiCard({ title, value, subtitle, icon, badge, variant = "default" }: KpiCardProps) {
  const variantStyles = {
    default: "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900",
    success: "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20",
    danger: "border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20",
    warning: "border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20",
    info: "border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20",
  };

  return (
    <div className={`p-5 rounded-xl border shadow-sm transition-all duration-150 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-200">
          {title}
        </span>
        {icon && <div className="text-slate-500 dark:text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
          {value}
        </div>
        {badge && <div>{badge}</div>}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-200">{subtitle}</p>
      )}
    </div>
  );
}