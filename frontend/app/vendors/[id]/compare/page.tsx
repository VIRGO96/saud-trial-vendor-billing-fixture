"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
} from "lucide-react";
import { fetchVendor, fetchComparison, Vendor, ComparisonData, ChangeRecord } from "@/lib/api";
import { formatCurrency, formatUnitCost } from "@/lib/utils";
import { KpiCard } from "@/components/KpiCard";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { MoneyDisplay } from "@/components/MoneyDisplay";

function CompareContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period selectors
  const [fromId, setFromId] = useState<string>(searchParams.get("from") || "");
  const [toId, setToId] = useState<string>(searchParams.get("to") || "");

  // Filters & State
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const vendorData = await fetchVendor(vendorId);
      setVendor(vendorData);

      if (vendorData.invoices.length < 2) {
        setError("Vendor must have at least two invoice periods to compare.");
        return;
      }

      // Default periods if not set
      let fId = fromId;
      let tId = toId;
      if (!fId || !tId) {
        const sorted = [...vendorData.invoices].sort((a, b) => a.period_label.localeCompare(b.period_label));
        fId = sorted[sorted.length - 2].id;
        tId = sorted[sorted.length - 1].id;
        setFromId(fId);
        setToId(tId);
      }

      const compData = await fetchComparison(vendorId, fId, tId);
      setComparison(compData);
    } catch (err: any) {
      setError(err.message || "Failed to load comparison data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      loadData();
    }
  }, [vendorId, fromId, toId]);

  const toggleRowExpand = (key: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = (format: "csv" | "xlsx") => {
    if (!vendor || !comparison) return;
    const url = `/api/vendors/${vendor.id}/compare/export?from=${comparison.invoice_from_id}&to=${comparison.invoice_to_id}&format=${format}`;
    window.open(url, "_blank");
    setShowExportMenu(false);
  };

  const filteredChanges = (comparison?.changes || []).filter((c) => {
    if (activeTab === "PRICE" && !c.change_types.includes("PRICE_CHANGED")) return false;
    if (activeTab === "QUANTITY" && !c.change_types.includes("QUANTITY_CHANGED")) return false;
    if (activeTab === "NEW" && !c.change_types.includes("NEW")) return false;
    if (activeTab === "REMOVED" && !c.change_types.includes("REMOVED")) return false;
    if (activeTab === "USAGE" && !c.change_types.includes("USAGE_CHANGED")) return false;

    if (accountFilter && c.account !== accountFilter) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAcc = c.account.toLowerCase().includes(q);
      const matchSku = (c.sku || "").toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      if (!matchAcc && !matchSku && !matchDesc) return false;
    }

    return true;
  });

  const distinctAccounts = Array.from(new Set((comparison?.changes || []).map((c) => c.account))).sort();

  return (
    <div className="space-y-8">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={`/vendors/${vendorId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {vendor?.name || "Vendor"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-2">
            {vendor ? `Period Reconciliation: ${vendor.name}` : "Period Reconciliation"}
          </h1>
        </div>

        {/* Export Menu Dropdown */}
        <div className="relative self-start sm:self-auto">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!comparison}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export Reconciliation</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-30">
              <button
                onClick={() => handleExport("xlsx")}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="font-semibold">Excel Workbook (.xlsx)</p>
                  <p className="text-[10px] text-slate-500">Summary + Changes tabs, styles</p>
                </div>
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="font-semibold">CSV Data (.csv)</p>
                  <p className="text-[10px] text-slate-500">UTF-8 with BOM for Excel & scripts</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Period Selection Controls Strip */}
      {vendor && vendor.invoices.length >= 2 && (
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Comparing Periods:
            </span>
            <div className="flex items-center gap-2">
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                aria-label="Base comparison period"
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {vendor.invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.period_label} ({formatCurrency(inv.computed_total)})
                  </option>
                ))}
              </select>

              <ArrowRight className="w-4 h-4 text-slate-400" />

              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                aria-label="Target comparison period"
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {vendor.invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.period_label} ({formatCurrency(inv.computed_total)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {comparison && (
            <div className="flex items-center gap-2 flex-wrap">
              {(comparison.is_synthetic_from || comparison.is_synthetic_to) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                  Test fixture
                </span>
              )}
              {comparison.reconciled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  100% Reconciled to the Cent
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Discrepancy: ${comparison.reconciliation_difference}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Cards Strip (5 cards) */}
      {comparison && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              title="Net Spend Delta"
              value={<MoneyDisplay amount={comparison.net_delta} isDelta={true} />}
              subtitle={`${comparison.period_from} (${formatCurrency(comparison.total_from)}) → ${comparison.period_to} (${formatCurrency(comparison.total_to)})`}
              icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
              variant="default"
            />
            <KpiCard
              title="Price Changes"
              value={comparison.counts_by_type.PRICE_CHANGED || 0}
              subtitle="Unit price altered"
              icon={<ArrowRight className="w-5 h-5 text-amber-500" />}
              variant="warning"
            />
            <KpiCard
              title="Quantity Changes"
              value={comparison.counts_by_type.QUANTITY_CHANGED || 0}
              subtitle="Seats/licenses modified"
              icon={<TrendingDown className="w-5 h-5 text-indigo-500" />}
              variant="info"
            />
            <KpiCard
              title="New Subscriptions"
              value={comparison.counts_by_type.NEW || 0}
              subtitle="Added services"
              icon={<PlusCircle className="w-5 h-5 text-emerald-500" />}
              variant="success"
            />
            <KpiCard
              title="Removed Subscriptions"
              value={comparison.counts_by_type.REMOVED || 0}
              subtitle="Dropped services"
              icon={<MinusCircle className="w-5 h-5 text-rose-500" />}
              variant="danger"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
            <p className="font-medium">
              <span className="font-bold text-slate-700 dark:text-slate-300">{comparison.unchanged_count}</span>{" "}
              {comparison.unchanged_count === 1 ? "subscription" : "subscriptions"} unchanged
            </p>
          </div>
        </div>
      )}

      {/* Changes Section */}
      <div className="space-y-4">
        {/* Change Type Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              All Changes {comparison ? `(${comparison.changes.length})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("PRICE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "PRICE"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Price {comparison ? `(${comparison.counts_by_type.PRICE_CHANGED || 0})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("QUANTITY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "QUANTITY"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Quantity {comparison ? `(${comparison.counts_by_type.QUANTITY_CHANGED || 0})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("NEW")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "NEW"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              New Items {comparison ? `(${comparison.counts_by_type.NEW || 0})` : ""}
            </button>
            <button
              onClick={() => setActiveTab("REMOVED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === "REMOVED"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Removed {comparison ? `(${comparison.counts_by_type.REMOVED || 0})` : ""}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              aria-label="Filter changes by account"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
            >
              <option value="">All Accounts ({distinctAccounts.length})</option>
              {distinctAccounts.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>

            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search changes..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Changes Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Change Type</th>
                  <th className="p-3">Account / Org</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Qty (From → To)</th>
                  <th className="p-3 text-right">Unit Price (From → To)</th>
                  <th className="p-3 text-right">Unit Δ %</th>
                  <th className="p-3 text-right">Amount (From → To)</th>
                  <th className="p-3 text-right">Net Impact ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="p-4">
                        <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredChanges.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-600 dark:text-slate-400">
                      No changes found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredChanges.map((c, idx) => {
                    const rowKey = `${c.account}-${c.sku || c.description}-${idx}`;
                    const isExpanded = expandedRowKeys.has(rowKey);

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          onClick={() => toggleRowExpand(rowKey)}
                          className={`cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isExpanded ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <td className="p-3 text-slate-500 dark:text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </td>
                          <td className="p-3">
                            <ChangeTypeBadge changeTypes={c.change_types} />
                          </td>
                          <td
                            className="p-3 font-semibold text-slate-900 dark:text-white max-w-[140px] truncate"
                            title={c.account}
                          >
                            {c.account}
                          </td>
                          <td
                            className="p-3 font-mono text-slate-600 dark:text-slate-400 max-w-[130px] truncate"
                            title={c.sku || "—"}
                          >
                            {c.sku || "—"}
                          </td>
                          <td
                            className="p-3 text-slate-700 dark:text-slate-300 max-w-[240px] truncate"
                            title={c.description}
                          >
                            {c.description}
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {c.qty_from ?? "—"} → <span className="font-bold">{c.qty_to ?? "—"}</span>
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {c.unit_from ? formatUnitCost(c.unit_from) : "—"} →{" "}
                            <span className="font-bold">{c.unit_to ? formatUnitCost(c.unit_to) : "—"}</span>
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums">
                            {c.unit_delta_pct ? (
                              <span
                                className={
                                  parseFloat(c.unit_delta_pct) > 0
                                    ? "text-rose-700 dark:text-rose-400 font-semibold"
                                    : parseFloat(c.unit_delta_pct) < 0
                                    ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                                    : "text-slate-600 dark:text-slate-400"
                                }
                              >
                                {parseFloat(c.unit_delta_pct) > 0 ? `+${c.unit_delta_pct}%` : `${c.unit_delta_pct}%`}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {c.amount_from ? formatCurrency(c.amount_from) : "—"} →{" "}
                            <span className="font-bold">{c.amount_to ? formatCurrency(c.amount_to) : "—"}</span>
                          </td>
                          <td className="p-3 text-right">
                            <MoneyDisplay amount={c.amount_delta} isDelta={true} />
                          </td>
                        </tr>

                        {/* Expandable Drilldown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-800/60">
                            <td colSpan={10} className="p-4 border-t border-b border-slate-200 dark:border-slate-800">
                              <div className="space-y-3 text-xs">
                                {/* Full SKU & Full Description Block */}
                                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                                      Full SKU:
                                    </span>
                                    <span className="font-mono text-slate-900 dark:text-white break-all font-semibold">
                                      {c.sku || "No SKU (matched by normalized description)"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                                      Full Description:
                                    </span>
                                    <span className="text-slate-900 dark:text-white break-words font-medium">
                                      {c.description}
                                    </span>
                                  </div>
                                </div>

                                {c.notes.length > 0 && (
                                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300">
                                    <span className="font-semibold block mb-0.5">Change Notes:</span>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                      {c.notes.map((note, n_idx) => (
                                        <li key={n_idx}>{note}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Side-by-side underlying rows */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* From Period Rows */}
                                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                                      Underlying Rows in {comparison?.period_from || "From"} ({c.rows_from.length} rows):
                                    </span>
                                    {c.rows_from.length === 0 ? (
                                      <p className="text-slate-400 italic">No line items in from-period (Item is NEW).</p>
                                    ) : (
                                      <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                                        {c.rows_from.map((r, r_i) => (
                                          <div key={r_i} className="pt-1.5 flex justify-between gap-2 font-mono">
                                            <span className="text-slate-600 dark:text-slate-400">
                                              Row {r.row_index}: {r.quantity} × {formatCurrency(r.unit_cost)}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                              {formatCurrency(r.line_total)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* To Period Rows */}
                                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                                      Underlying Rows in {comparison?.period_to || "To"} ({c.rows_to.length} rows):
                                    </span>
                                    {c.rows_to.length === 0 ? (
                                      <p className="text-slate-400 italic">No line items in to-period (Item was REMOVED).</p>
                                    ) : (
                                      <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                                        {c.rows_to.map((r, r_i) => (
                                          <div key={r_i} className="pt-1.5 flex justify-between gap-2 font-mono">
                                            <span className="text-slate-600 dark:text-slate-400">
                                              Row {r.row_index}: {r.quantity} × {formatCurrency(r.unit_cost)}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                              {formatCurrency(r.line_total)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VendorComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}