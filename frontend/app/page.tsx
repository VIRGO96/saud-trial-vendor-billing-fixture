"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Layers, ArrowRight, UploadCloud, CheckCircle2, DollarSign, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { fetchVendors, Vendor } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { KpiCard } from "@/components/KpiCard";
import { FormatBadge } from "@/components/FormatBadge";
import { UploadModal } from "@/components/UploadModal";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVendors();
      setVendors(data);
    } catch (err: any) {
      setError(err.message || "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const totalInvoices = vendors.reduce((acc, v) => acc + v.invoices_count, 0);
  const totalSpend = vendors.reduce(
    (acc, v) => acc + (v.latest_real_total ? parseFloat(v.latest_real_total) : (v.latest_total && !v.has_synthetic ? parseFloat(v.latest_total) : 0)),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Vendors & Spend Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor vendor invoices, track monthly subscription changes, and detect price fluctuations.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          Upload Invoice
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tracked Vendors"
          value={vendors.length}
          subtitle="Active software & cloud providers"
          icon={<Building2 className="w-5 h-5 text-blue-500" />}
          variant="info"
        />
        <KpiCard
          title="Total Ingested Invoices"
          value={totalInvoices}
          subtitle="Processed CSV & PDF documents"
          icon={<Layers className="w-5 h-5 text-emerald-500" />}
          variant="success"
        />
        <KpiCard
          title="Latest Monitored Spend"
          value={formatCurrency(totalSpend)}
          subtitle="Excludes synthetic test fixtures"
          icon={<DollarSign className="w-5 h-5 text-slate-500" />}
          variant="default"
        />
        <KpiCard
          title="Reconciliation Engine"
          value="Active"
          subtitle="100% deterministic Decimal precision"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          variant="success"
        />
      </div>

      {/* Vendors List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Vendor Accounts</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
              {vendors.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse p-6"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 text-center">
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p>
            <button
              onClick={loadVendors}
              className="mt-3 text-xs font-semibold px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
            >
              Retry Loading
            </button>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-12 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 text-center space-y-4 bg-white dark:bg-slate-900/50">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No invoices uploaded yet</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Upload your first monthly invoice to start tracking subscriptions and price changes.
              </p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Upload First Invoice
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base">
                        {vendor.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                          {vendor.name}
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {vendor.invoices_count} {vendor.invoices_count === 1 ? "period" : "periods"} tracked
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Latest invoice info */}
                  <div className="mt-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Latest Period</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                        {vendor.latest_real_period || vendor.latest_period || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Latest Amount</span>
                      <span className="font-semibold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(vendor.latest_real_total || vendor.latest_total)}
                      </span>
                    </div>
                  </div>

                  {/* Formats present */}
                  <div className="mt-3 flex items-center gap-2">
                    {Array.from(new Set(vendor.invoices.map((inv) => inv.source_format))).map((fmt) => (
                      <FormatBadge key={fmt} format={fmt} />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 py-1.5 transition-colors"
                  >
                    View Invoices
                  </Link>

                  {vendor.invoices_count >= 2 ? (
                    <Link
                      href={`/vendors/${vendor.id}/compare`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-900 dark:bg-blue-700 dark:text-white hover:bg-blue-200 dark:hover:bg-blue-600 transition-colors"
                    >
                      <span>Compare Diff</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Upload 2nd period to diff
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            loadVendors();
          }}
        />
      )}
    </div>
  );
}