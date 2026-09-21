"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  UploadCloud,
  Calendar,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Trash2,
  AlertTriangle,
  FileSearch,
  ExternalLink,
} from "lucide-react";
import { fetchVendor, deleteInvoice, Vendor } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FormatBadge } from "@/components/FormatBadge";
import { UploadModal } from "@/components/UploadModal";

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadVendorData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchVendor(vendorId);
      setVendor(data);
    } catch (err: any) {
      setError(err.message || "Failed to load vendor details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      loadVendorData();
    }
  }, [vendorId]);

  const handleDelete = async (invoiceId: string, period: string) => {
    if (!confirm(`Are you sure you want to delete invoice for period ${period}?`)) return;
    try {
      setDeletingId(invoiceId);
      await deleteInvoice(invoiceId);
      await loadVendorData();
    } catch (err: any) {
      alert(err.message || "Failed to delete invoice.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error || "Vendor not found."}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg hover:bg-slate-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendors
        </Link>

        {vendor.invoices.length >= 2 && (
          <Link
            href={`/vendors/${vendor.id}/compare`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
          >
            <span>Compare Billing Diff</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Vendor Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold text-2xl">
            {vendor.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vendor.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Slug: {vendor.slug} · Created {formatDate(vendor.created_at)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4 text-blue-600" />
          Upload New Invoice
        </button>
      </div>

      {/* Invoices Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Billing Periods & Invoices</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
              {vendor.invoices.length}
            </span>
          </h2>
        </div>

        {vendor.invoices.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
            <Layers className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No invoices found for {vendor.name}
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upload Invoice
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {vendor.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center font-mono text-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-slate-400 mb-0.5" />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {inv.period_label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {formatCurrency(inv.computed_total, inv.currency)}
                        </span>
                        <FormatBadge format={inv.source_format} />
                        {inv.is_synthetic && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Test fixture
                          </span>
                        )}
                        {inv.warnings_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3" />
                            {inv.warnings_count} {inv.warnings_count === 1 ? "warning" : "warnings"}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        <span>File: <span className="font-mono text-slate-700 dark:text-slate-300">{inv.source_filename}</span></span>
                        {inv.invoice_number && <span>· Inv #: <span className="font-mono">{inv.invoice_number}</span></span>}
                        {inv.invoice_date && <span>· Date: {formatDate(inv.invoice_date)}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                      View Line Items
                    </Link>

                    <button
                      onClick={() => handleDelete(inv.id, inv.period_label)}
                      disabled={deletingId === inv.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showUpload && (
        <UploadModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          presetVendorId={vendor.id}
          presetVendorName={vendor.name}
          onSuccess={() => {
            setShowUpload(false);
            loadVendorData();
          }}
        />
      )}
    </div>
  );
}