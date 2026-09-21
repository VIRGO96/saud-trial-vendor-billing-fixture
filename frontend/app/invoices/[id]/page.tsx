"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Download,
  AlertTriangle,
  Building2,
  Calendar,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";
import { fetchInvoice, fetchLineItems, InvoiceSummary, LineItem } from "@/lib/api";
import { formatCurrency, formatUnitCost, formatDate } from "@/lib/utils";
import { FormatBadge } from "@/components/FormatBadge";
import { KindBadge } from "@/components/KindBadge";

export default function InvoiceLineItemsPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<string>("0");
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedKind, setSelectedKind] = useState("");
  const [showInfoRows, setShowInfoRows] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, itemsData] = await Promise.all([
        fetchInvoice(invoiceId),
        fetchLineItems(invoiceId, {
          query: searchQuery,
          account: selectedAccount,
          kind: selectedKind,
          show_info: showInfoRows,
          page,
          page_size: pageSize,
        }),
      ]);
      setInvoice(invData);
      setItems(itemsData.items);
      setAccounts(itemsData.accounts);
      setTotalCount(itemsData.total_count);
      setTotalAmount(itemsData.total_amount);
    } catch (err: any) {
      console.error("Failed to load invoice items", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      loadData();
    }
  }, [invoiceId, searchQuery, selectedAccount, selectedKind, showInfoRows, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Link
          href={invoice ? `/vendors/${invoice.vendor_id}` : "/"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendor Invoices
        </Link>
      </div>

      {/* Invoice Overview Card */}
      {invoice && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Invoice Period: <span className="font-mono text-blue-600">{invoice.period_label}</span>
                </h1>
                <FormatBadge format={invoice.source_format} />
                {invoice.is_synthetic && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Test fixture
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                Source: {invoice.source_filename}
                {invoice.invoice_number && ` · Invoice #: ${invoice.invoice_number}`}
                {invoice.invoice_date && ` · Date: ${formatDate(invoice.invoice_date)}`}
              </p>
            </div>

            <div className="text-right self-start sm:self-auto">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Invoice Amount</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                {formatCurrency(invoice.computed_total, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Filtered Line Items</span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {totalCount} rows
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Unique Accounts</span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {accounts.length} organizations
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Filtered Total</span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {formatCurrency(totalAmount, invoice.currency)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Parser Engine</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate block">
                {invoice.parser_name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 flex-wrap">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search description, SKU, or account..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by account"
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px]"
          >
            <option value="">All Accounts ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>

          {/* Kind Filter */}
          <select
            value={selectedKind}
            onChange={(e) => {
              setSelectedKind(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by kind"
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Item Types</option>
            <option value="charge">Charges Only</option>
            <option value="credit">Credits Only</option>
            <option value="usage">Usage Only</option>
            <option value="info">Info Only</option>
          </select>
        </div>

        {/* Toggle Info Rows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfoRows(!showInfoRows)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              showInfoRows
                ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
            }`}
          >
            {showInfoRows ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showInfoRows ? "Hide Info Rows" : "Show Info Rows"}</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold sticky top-0">
              <tr>
                <th className="p-3 w-8"></th>
                <th className="p-3 w-12 font-mono">#</th>
                <th className="p-3">Account / Customer</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Line Total</th>
                <th className="p-3 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    Loading line items...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    No line items match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isExpanded = expandedRowId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                        className={`cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isExpanded ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        <td className="p-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{item.row_index}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white max-w-[150px] truncate">
                          {item.account}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400 max-w-[130px] truncate">
                          {item.sku || "—"}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 max-w-[280px] truncate">
                          {item.description}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {item.kind === "info" ? "—" : item.quantity}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {item.kind === "info" ? "—" : formatUnitCost(item.unit_cost)}
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatCurrency(item.line_total)}
                        </td>
                        <td className="p-3 text-center">
                          <KindBadge kind={item.kind} />
                        </td>
                      </tr>

                      {/* Row Expansion */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/60">
                          <td colSpan={9} className="p-4 border-t border-b border-slate-200 dark:border-slate-800">
                            <div className="space-y-2 text-xs">
                              <p className="font-semibold text-slate-700 dark:text-slate-300">
                                Full Description & Raw Parser Payload:
                              </p>
                              <p className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-sans">
                                {item.description}
                              </p>
                              {item.raw_data && Object.keys(item.raw_data).length > 0 && (
                                <pre className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono overflow-x-auto text-[11px]">
                                  {JSON.stringify(item.raw_data, null, 2)}
                                </pre>
                              )}
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

        {/* Pagination Controls */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Showing {Math.min((page - 1) * pageSize + 1, totalCount)} to {Math.min(page * pageSize, totalCount)} of {totalCount} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="font-mono font-semibold px-2 text-slate-700 dark:text-slate-300">
              Page {page} of {Math.ceil(totalCount / pageSize) || 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(totalCount / pageSize)}
              className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}