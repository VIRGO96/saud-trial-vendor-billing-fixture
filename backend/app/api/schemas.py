from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class VendorBase(BaseModel):
    name: str

class VendorCreate(VendorBase):
    pass

class InvoiceSummary(BaseModel):
    id: str
    vendor_id: str
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    period_label: str
    currency: str
    declared_total: Optional[str] = None
    computed_total: str
    source_filename: str
    file_sha256: str
    source_format: str
    parser_name: str
    warnings_count: int
    is_synthetic: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VendorResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime
    invoices_count: int = 0
    latest_period: Optional[str] = None
    latest_total: Optional[str] = None
    latest_invoice_id: Optional[str] = None
    latest_real_period: Optional[str] = None
    latest_real_total: Optional[str] = None
    latest_is_synthetic: bool = False
    has_synthetic: bool = False
    invoices: List[InvoiceSummary] = []

    model_config = ConfigDict(from_attributes=True)

class LineItemResponse(BaseModel):
    id: str
    invoice_id: str
    row_index: int
    account: str
    sku: Optional[str] = None
    description: str
    match_key: str
    quantity: str
    list_price: Optional[str] = None
    unit_cost: str
    line_total: str
    kind: str
    raw_data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class LineItemsPaginatedResponse(BaseModel):
    items: List[LineItemResponse]
    total_count: int
    page: int
    page_size: int
    total_amount: str
    accounts: List[str]

class ParsePreviewRow(BaseModel):
    row_index: int
    account: str
    sku: Optional[str] = None
    description: str
    quantity: str
    unit_cost: str
    line_total: str
    kind: str

class InvoicePreviewResponse(BaseModel):
    vendor_guess: str
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    period_label: str
    currency: str
    declared_total: Optional[str] = None
    computed_total: str
    source_format: str
    line_count: int
    charge_rows_count: int = 0
    credit_rows_count: int = 0
    info_rows_count: int = 0
    usage_rows_count: int = 0
    file_sha256: str
    is_synthetic: bool = False
    warnings: List[Dict[str, Any]]
    preview_rows: List[ParsePreviewRow]

class ChangeRecordResponse(BaseModel):
    account: str
    sku: Optional[str] = None
    description: str
    kind: str
    change_types: List[str]
    qty_from: Optional[str] = None
    qty_to: Optional[str] = None
    qty_delta: Optional[str] = None
    net_qty_from: Optional[str] = None
    net_qty_to: Optional[str] = None
    net_qty_delta: Optional[str] = None
    unit_from: Optional[str] = None
    unit_to: Optional[str] = None
    unit_delta: Optional[str] = None
    unit_delta_pct: Optional[str] = None
    amount_from: Optional[str] = None
    amount_to: Optional[str] = None
    amount_delta: str
    notes: List[str]
    rows_from: List[Dict[str, Any]] = []
    rows_to: List[Dict[str, Any]] = []

class ComparisonResponse(BaseModel):
    vendor_id: Optional[str] = None
    vendor_name: str
    period_from: str
    period_to: str
    invoice_from_id: Optional[str] = None
    invoice_to_id: Optional[str] = None
    is_synthetic_from: bool = False
    is_synthetic_to: bool = False
    total_from: str
    total_to: str
    net_delta: str
    counts_by_type: Dict[str, int]
    reconciled: bool
    reconciliation_difference: str
    changes: List[ChangeRecordResponse]
    unchanged_count: int