import React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";

export function FormatBadge({ format }: { format: "csv" | "pdf" | string }) {
  const isCsv = format.toLowerCase() === "csv";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
        isCsv
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
          : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
      }`}
    >
      {isCsv ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
      {format.toUpperCase()}
    </span>
  );
}