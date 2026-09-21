import React from "react";
import { ArrowUpRight, ArrowDownRight, PlusCircle, MinusCircle, Activity, CheckCircle2 } from "lucide-react";

export function ChangeTypeBadge({ changeTypes }: { changeTypes: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {changeTypes.map((type) => {
        switch (type) {
          case "NEW":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                NEW
              </span>
            );
          case "REMOVED":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
              >
                <MinusCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                REMOVED
              </span>
            );
          case "PRICE_CHANGED":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                PRICE
              </span>
            );
          case "QUANTITY_CHANGED":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                QUANTITY
              </span>
            );
          case "USAGE_CHANGED":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
              >
                <Activity className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                USAGE
              </span>
            );
          case "UNCHANGED":
            return (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                UNCHANGED
              </span>
            );
          default:
            return (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {type}
              </span>
            );
        }
      })}
    </div>
  );
}