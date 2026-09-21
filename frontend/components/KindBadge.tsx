import React from "react";
import { CreditCard, Info, Activity, DollarSign } from "lucide-react";

export function KindBadge({ kind }: { kind: "charge" | "credit" | "info" | "usage" | string }) {
  switch (kind) {
    case "credit":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700">
          <CreditCard className="w-3 h-3" />
          Credit
        </span>
      );
    case "usage":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-900/50 dark:text-sky-200 dark:border-sky-700">
          <Activity className="w-3 h-3" />
          Usage
        </span>
      );
    case "info":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700">
          <Info className="w-3 h-3" />
          Info Only
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          <DollarSign className="w-3 h-3" />
          Charge
        </span>
      );
  }
}