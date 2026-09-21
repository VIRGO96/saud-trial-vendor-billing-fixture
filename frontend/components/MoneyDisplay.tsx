import React from "react";
import { formatCurrency } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MoneyDisplayProps {
  amount: string | number;
  isDelta?: boolean;
  currency?: string;
  className?: string;
}

export function MoneyDisplay({ amount, isDelta = false, currency = "USD", className = "" }: MoneyDisplayProps) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const isPositive = num > 0;
  const isNegative = num < 0;

  if (!isDelta) {
    return (
      <span className={`font-mono tabular-nums text-slate-900 dark:text-slate-100 ${className}`}>
        {formatCurrency(num, currency)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-semibold ${
        isPositive
          ? "text-rose-700 dark:text-rose-400"
          : isNegative
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-slate-600 dark:text-slate-400"
      } ${className}`}
    >
      {isPositive && <ArrowUp className="w-3.5 h-3.5 inline-block -mr-0.5 stroke-[2.5]" />}
      {isNegative && <ArrowDown className="w-3.5 h-3.5 inline-block -mr-0.5 stroke-[2.5]" />}
      {isPositive ? `+${formatCurrency(num, currency)}` : formatCurrency(num, currency)}
    </span>
  );
}