export interface Vendor {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  invoices_count: number;
  latest_period?: string;
  latest_total?: string;
  latest_real_period?: string;
  latest_real_total?: string;
  latest_is_synthetic?: boolean;
  has_synthetic?: boolean;
  latest_invoice_id?: string;
  invoices: InvoiceSummary[];
}

export interface InvoiceSummary {
  id: string;
  vendor_id: string;
  invoice_number?: string;
  invoice_date?: string;
  period_from?: string;
  period_to?: string;
  period_label: string;
  currency: string;
  declared_total?: string;
  computed_total: string;
  source_filename: string;
  file_sha256: string;
  source_format: "csv" | "pdf";
  parser_name: string;
  is_synthetic: boolean;
  warnings_count: number;
  created_at: string;
}

export interface LineItem {
  id: string;
  invoice_id: string;
  row_index: number;
  account: string;
  sku?: string;
  description: string;
  match_key: string;
  quantity: string;
  list_price?: string;
  unit_cost: string;
  line_total: string;
  kind: "charge" | "credit" | "info" | "usage";
  raw_data?: Record<string, any>;
}

export interface LineItemsResponse {
  items: LineItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_amount: string;
  accounts: string[];
}

export interface ParsePreviewRow {
  row_index: number;
  account: string;
  sku?: string;
  description: string;
  quantity: string;
  unit_cost: string;
  line_total: string;
  kind: string;
}

export interface InvoicePreview {
  vendor_guess: string;
  invoice_number?: string;
  invoice_date?: string;
  period_from?: string;
  period_to?: string;
  period_label: string;
  currency: string;
  declared_total?: string;
  computed_total: string;
  source_format: string;
  line_count: number;
  charge_rows_count?: number;
  credit_rows_count?: number;
  info_rows_count?: number;
  usage_rows_count?: number;
  file_sha256: string;
  is_synthetic: boolean;
  warnings: Array<{ row_index?: number; message: string; severity: string }>;
  preview_rows: ParsePreviewRow[];
}

export interface UnderlyingRow {
  row_index: number;
  account: string;
  sku?: string;
  description: string;
  quantity: string;
  unit_cost: string;
  line_total: string;
  kind: string;
}

export interface ChangeRecord {
  account: string;
  sku?: string;
  description: string;
  kind: string;
  change_types: string[];
  qty_from?: string | null;
  qty_to?: string | null;
  qty_delta?: string | null;
  net_qty_from?: string | null;
  net_qty_to?: string | null;
  net_qty_delta?: string | null;
  unit_from?: string | null;
  unit_to?: string | null;
  unit_delta?: string | null;
  unit_delta_pct?: string | null;
  amount_from?: string | null;
  amount_to?: string | null;
  amount_delta: string;
  notes: string[];
  rows_from: UnderlyingRow[];
  rows_to: UnderlyingRow[];
}

export interface ComparisonData {
  vendor_id?: string;
  vendor_name: string;
  period_from: string;
  period_to: string;
  invoice_from_id?: string;
  invoice_to_id?: string;
  is_synthetic_from?: boolean;
  is_synthetic_to?: boolean;
  total_from: string;
  total_to: string;
  net_delta: string;
  counts_by_type: Record<string, number>;
  reconciled: boolean;
  reconciliation_difference: string;
  changes: ChangeRecord[];
  unchanged_count: number;
}

const API_BASE = "/api";

export async function fetchVendors(): Promise<Vendor[]> {
  const res = await fetch(`${API_BASE}/vendors`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch vendors list.");
  return res.json();
}

export async function fetchVendor(id: string): Promise<Vendor> {
  const res = await fetch(`${API_BASE}/vendors/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch vendor '${id}'.`);
  return res.json();
}

export async function fetchInvoice(id: string): Promise<InvoiceSummary> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch invoice details.");
  return res.json();
}

export async function deleteInvoice(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete invoice.");
}

export async function fetchLineItems(
  invoiceId: string,
  params: {
    query?: string;
    account?: string;
    kind?: string;
    show_info?: boolean;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_dir?: string;
  }
): Promise<LineItemsResponse> {
  const q = new URLSearchParams();
  if (params.query) q.set("query", params.query);
  if (params.account) q.set("account", params.account);
  if (params.kind) q.set("kind", params.kind);
  if (params.show_info !== undefined) q.set("show_info", String(params.show_info));
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_dir) q.set("sort_dir", params.sort_dir);

  const res = await fetch(`${API_BASE}/invoices/${invoiceId}/line-items?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch line items.");
  return res.json();
}

export async function previewInvoiceFile(file: File): Promise<InvoicePreview> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/invoices/preview`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Parsing error" }));
    throw new Error(errorData.detail || "Unable to parse invoice preview.");
  }
  return res.json();
}

export async function uploadInvoiceFile(
  file: File,
  options: {
    vendor_id?: string;
    vendor_name?: string;
    period_label?: string;
    replace?: boolean;
  }
): Promise<InvoiceSummary> {
  const formData = new FormData();
  formData.append("file", file);
  if (options.vendor_id) formData.append("vendor_id", options.vendor_id);
  if (options.vendor_name) formData.append("vendor_name", options.vendor_name);
  if (options.period_label) formData.append("period_label", options.period_label);
  if (options.replace !== undefined) formData.append("replace", String(options.replace));

  const res = await fetch(`${API_BASE}/invoices`, {
    method: "POST",
    body: formData,
  });

  if (res.status === 409) {
    const conflict = await res.json();
    const error: any = new Error(conflict.detail?.message || "Invoice conflict detected.");
    error.status = 409;
    error.conflictData = conflict.detail;
    throw error;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Upload failed." }));
    throw new Error(errorData.detail || "Failed to upload invoice.");
  }

  return res.json();
}

export async function fetchComparison(
  vendorId: string,
  fromId?: string,
  toId?: string
): Promise<ComparisonData> {
  const q = new URLSearchParams();
  if (fromId) q.set("from", fromId);
  if (toId) q.set("to", toId);

  const res = await fetch(`${API_BASE}/vendors/${vendorId}/compare?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Comparison failed." }));
    throw new Error(errorData.detail || "Failed to fetch period comparison.");
  }
  return res.json();
}