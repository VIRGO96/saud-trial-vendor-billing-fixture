"use client";

import React, { useState, useRef } from "react";
import { X, UploadCloud, FileSpreadsheet, FileText, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { previewInvoiceFile, uploadInvoiceFile, InvoicePreview } from "@/lib/api";
import { formatCurrency, formatUnitCost } from "@/lib/utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  presetVendorId?: string;
  presetVendorName?: string;
}

export function UploadModal({ isOpen, onClose, onSuccess, presetVendorId, presetVendorName }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<any | null>(null);
  const [customPeriod, setCustomPeriod] = useState<string>("");
  const [customVendor, setCustomVendor] = useState<string>(presetVendorName || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (selectedFile: File) => {
    setError(null);
    setConflictData(null);
    setPreview(null);
    setFile(selectedFile);
    setParsing(true);

    try {
      const data = await previewInvoiceFile(selectedFile);
      setPreview(data);
      setCustomPeriod(data.period_label || "");
      if (!customVendor) {
        setCustomVendor(presetVendorName || data.vendor_guess || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to parse document preview.");
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmUpload = async (replace: boolean = false) => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setConflictData(null);

    try {
      await uploadInvoiceFile(file, {
        vendor_id: presetVendorId,
        vendor_name: customVendor || presetVendorName || preview?.vendor_guess,
        period_label: customPeriod || preview?.period_label,
        replace,
      });
      if (onSuccess) onSuccess();
      else onClose();
    } catch (err: any) {
      if (err.status === 409 && err.conflictData) {
        setConflictData(err.conflictData);
      } else {
        setError(err.message || "Failed to complete upload.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upload Vendor Invoice</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Drop any monthly billing invoice (CSV or PDF) for automated parsing and reconciliation.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Drag and Drop Zone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-slate-300 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf,text/csv,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Click to browse or drag and drop invoice file
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supports Sherweb CSV, PowerDMARC PDF, and standardized billing exports (Max 10 MB)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 truncate">
                {file.name.endsWith(".csv") ? (
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                ) : (
                  <FileText className="w-6 h-6 text-rose-600 flex-shrink-0" />
                )}
                <div className="truncate">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setError(null);
                  setConflictData(null);
                }}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Change File
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {parsing && (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-600 dark:text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Extracting and normalizing invoice line items...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold">Parsing Issue</p>
                <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{error}</p>
              </div>
            </div>
          )}

          {/* Conflict 409 Warning */}
          {conflictData && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
              <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Invoice Already Exists</p>
                  <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-300">
                    {conflictData.message || "An invoice for this period or identical content already exists."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                <button
                  type="button"
                  onClick={() => setConflictData(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmUpload(true)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Replace Existing Invoice
                </button>
              </div>
            </div>
          )}

          {/* Parsed Preview Card */}
          {preview && !conflictData && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      Parsed Summary
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 font-medium">
                    {preview.source_format.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 block font-medium">Vendor</label>
                    <input
                      type="text"
                      value={customVendor}
                      onChange={(e) => setCustomVendor(e.target.value)}
                      placeholder="Vendor name"
                      className="mt-0.5 w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-semibold focus:ring-1 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Line Items</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {preview.line_count} rows
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Computed Total</span>
                    <span className="font-semibold text-slate-900 dark:text-white font-mono">
                      {formatCurrency(preview.computed_total)}
                    </span>
                  </div>
                  <div>
                    <label className="text-slate-500 dark:text-slate-400 block font-medium">
                      Period (YYYY-MM)
                    </label>
                    <input
                      type="text"
                      value={customPeriod}
                      onChange={(e) => setCustomPeriod(e.target.value)}
                      placeholder="YYYY-MM"
                      className="mt-0.5 w-full px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-mono focus:ring-1 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Row Type Breakdown Chips */}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-blue-100 dark:border-slate-700">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                    {preview.charge_rows_count ?? preview.line_count} charge rows
                  </span>
                  {(preview.credit_rows_count ?? 0) > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                      {preview.credit_rows_count} credit/partial rows
                    </span>
                  )}
                  {(preview.info_rows_count ?? 0) > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                      {preview.info_rows_count} info rows
                    </span>
                  )}
                  {(preview.usage_rows_count ?? 0) > 0 && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono">
                      {preview.usage_rows_count} usage rows
                    </span>
                  )}
                </div>

                {/* Declared vs Computed Total for PDFs */}
                {preview.declared_total && (
                  <div className="pt-2 border-t border-blue-100 dark:border-slate-700">
                    {preview.declared_total === preview.computed_total ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Declared invoice total matches computed line items ({formatCurrency(preview.declared_total)})</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Declared total ({formatCurrency(preview.declared_total)}) differs from computed ({formatCurrency(preview.computed_total)})</span>
                      </div>
                    )}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-200/50 dark:border-slate-700">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {preview.warnings.length} Parsing Warnings:
                    </span>
                    <ul className="mt-1 text-xs text-slate-600 dark:text-slate-400 space-y-0.5 list-disc pl-4">
                      {preview.warnings.slice(0, 3).map((w, idx) => (
                        <li key={idx}>{w.message}</li>
                      ))}
                      {preview.warnings.length > 3 && (
                        <li>...and {preview.warnings.length - 3} more warnings</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              {/* Sample Rows Preview Table */}
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  First {preview.preview_rows.length} Extracted Rows:
                </span>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-48 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Account</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {preview.preview_rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2 font-mono text-slate-400">{r.row_index}</td>
                          <td className="p-2 font-medium truncate max-w-[120px]">{r.account}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{r.description}</td>
                          <td className="p-2 text-right font-mono">{r.quantity}</td>
                          <td className="p-2 text-right font-mono">{formatUnitCost(r.unit_cost)}</td>
                          <td className="p-2 text-right font-mono font-semibold">{formatCurrency(r.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!preview || submitting || Boolean(conflictData)}
            onClick={() => handleConfirmUpload(false)}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                Upload & Confirm
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}