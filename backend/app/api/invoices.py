import hashlib
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from slugify import slugify
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Invoice, LineItem, Vendor
from app.parsers.base import ParseError
from app.parsers.registry import default_registry
from app.api.schemas import (
    InvoicePreviewResponse,
    InvoiceSummary,
    LineItemResponse,
    LineItemsPaginatedResponse,
    ParsePreviewRow,
)

router = APIRouter(prefix="/invoices", tags=["invoices"])

MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB

@router.post("/preview", response_model=InvoicePreviewResponse)
async def preview_invoice(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds maximum size of 10 MB.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_hash = hashlib.sha256(content).hexdigest()
    filename = file.filename or "unknown"

    try:
        parse_result = default_registry.parse(filename, content)
    except ParseError as e:
        raise HTTPException(status_code=422, detail=f"Parsing error: {e.message}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected parsing failure: {str(e)}")

    preview_rows = [
        ParsePreviewRow(
            row_index=item.row_index,
            account=item.account,
            sku=item.sku,
            description=item.description,
            quantity=str(item.quantity),
            unit_cost=str(item.unit_cost),
            line_total=str(item.line_total),
            kind=item.kind
        )
        for item in parse_result.line_items[:15]
    ]

    charge_count = sum(1 for item in parse_result.line_items if item.kind == "charge")
    credit_count = sum(1 for item in parse_result.line_items if item.kind == "credit")
    info_count = sum(1 for item in parse_result.line_items if item.kind == "info")
    usage_count = sum(1 for item in parse_result.line_items if item.kind == "usage")

    return InvoicePreviewResponse(
        vendor_guess=parse_result.vendor_guess,
        invoice_number=parse_result.invoice_meta.invoice_number,
        invoice_date=parse_result.invoice_meta.invoice_date,
        period_from=parse_result.invoice_meta.period_from,
        period_to=parse_result.invoice_meta.period_to,
        period_label=parse_result.invoice_meta.period_label,
        currency=parse_result.invoice_meta.currency,
        declared_total=str(parse_result.invoice_meta.declared_total) if parse_result.invoice_meta.declared_total is not None else None,
        computed_total=str(parse_result.computed_total),
        source_format=parse_result.invoice_meta.source_format,
        line_count=len(parse_result.line_items),
        charge_rows_count=charge_count,
        credit_rows_count=credit_count,
        info_rows_count=info_count,
        usage_rows_count=usage_count,
        file_sha256=file_hash,
        is_synthetic=('synthetic' in filename.lower()),
        warnings=[{'row_index': w.row_index, 'message': w.message, 'severity': w.severity} for w in parse_result.warnings],
        preview_rows=preview_rows
    )

@router.post("", response_model=InvoiceSummary, status_code=status.HTTP_201_CREATED)
async def upload_invoice(
    file: UploadFile = File(...),
    vendor_id: Optional[str] = Form(None),
    vendor_name: Optional[str] = Form(None),
    period_label: Optional[str] = Form(None),
    is_synthetic: bool = Form(False),
    replace: bool = Form(False),
    db: Session = Depends(get_db)
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds maximum size of 10 MB.")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = file.filename or "unknown"
    file_hash = hashlib.sha256(content).hexdigest()

    try:
        parse_result = default_registry.parse(filename, content)
    except ParseError as e:
        raise HTTPException(status_code=422, detail=f"Parsing error: {e.message}")

    # Determine vendor
    vendor = None
    if vendor_id:
        vendor = db.query(Vendor).filter((Vendor.id == vendor_id) | (Vendor.slug == vendor_id)).first()
    if not vendor:
        target_name = (vendor_name or parse_result.vendor_guess).strip()
        slug = slugify(target_name)
        vendor = db.query(Vendor).filter((Vendor.name == target_name) | (Vendor.slug == slug)).first()
        if not vendor:
            vendor = Vendor(name=target_name, slug=slug)
            db.add(vendor)
            db.commit()
            db.refresh(vendor)

    final_period_label = (period_label or parse_result.invoice_meta.period_label).strip()

    # Check for duplicate hash
    existing_by_hash = db.query(Invoice).filter_by(file_sha256=file_hash).first()
    if existing_by_hash:
        if not replace:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"This identical file was already uploaded for period '{existing_by_hash.period_label}'.",
                    "conflict_type": "hash",
                    "existing_invoice_id": existing_by_hash.id,
                    "existing_period": existing_by_hash.period_label,
                    "can_replace": True
                }
            )
        else:
            db.delete(existing_by_hash)
            db.commit()

    # Check for duplicate vendor + period
    existing_by_period = db.query(Invoice).filter_by(vendor_id=vendor.id, period_label=final_period_label).first()
    if existing_by_period:
        if not replace:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"An invoice for '{vendor.name}' in period '{final_period_label}' already exists ({existing_by_period.source_filename}).",
                    "conflict_type": "period",
                    "existing_invoice_id": existing_by_period.id,
                    "existing_period": existing_by_period.period_label,
                    "can_replace": True
                }
            )
        else:
            db.delete(existing_by_period)
            db.commit()

    # Create new invoice
    is_synth = is_synthetic or ('synthetic' in filename.lower())
    invoice = Invoice(
        vendor_id=vendor.id,
        invoice_number=parse_result.invoice_meta.invoice_number,
        invoice_date=parse_result.invoice_meta.invoice_date,
        period_from=parse_result.invoice_meta.period_from,
        period_to=parse_result.invoice_meta.period_to,
        period_label=final_period_label,
        currency=parse_result.invoice_meta.currency,
        declared_total=parse_result.invoice_meta.declared_total,
        computed_total=parse_result.computed_total,
        source_filename=filename,
        file_sha256=file_hash,
        source_format=parse_result.invoice_meta.source_format,
        parser_name=parse_result.parser_name,
        parser_version=parse_result.parser_version,
        warnings=[{'row_index': w.row_index, 'message': w.message, 'severity': w.severity} for w in parse_result.warnings],
        is_synthetic=is_synth
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Add line items
    line_item_objs = [
        LineItem(
            invoice_id=invoice.id,
            row_index=item.row_index,
            account=item.account,
            sku=item.sku,
            description=item.description,
            match_key=item.match_key,
            quantity=item.quantity,
            list_price=item.list_price,
            unit_cost=item.unit_cost,
            line_total=item.line_total,
            kind=item.kind,
            raw_data=item.raw_data
        )
        for item in parse_result.line_items
    ]
    db.bulk_save_objects(line_item_objs)
    db.commit()

    return InvoiceSummary(
        id=invoice.id,
        vendor_id=invoice.vendor_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        period_from=invoice.period_from,
        period_to=invoice.period_to,
        period_label=invoice.period_label,
        currency=invoice.currency,
        declared_total=str(invoice.declared_total) if invoice.declared_total is not None else None,
        computed_total=str(invoice.computed_total),
        source_filename=invoice.source_filename,
        file_sha256=invoice.file_sha256,
        source_format=invoice.source_format,
        parser_name=invoice.parser_name,
        warnings_count=len(invoice.warnings or []),
        is_synthetic=bool(invoice.is_synthetic),
        created_at=invoice.created_at
    )

@router.get("/{id}", response_model=InvoiceSummary)
def get_invoice(id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter_by(id=id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    return InvoiceSummary(
        id=invoice.id,
        vendor_id=invoice.vendor_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        period_from=invoice.period_from,
        period_to=invoice.period_to,
        period_label=invoice.period_label,
        currency=invoice.currency,
        declared_total=str(invoice.declared_total) if invoice.declared_total is not None else None,
        computed_total=str(invoice.computed_total),
        source_filename=invoice.source_filename,
        file_sha256=invoice.file_sha256,
        source_format=invoice.source_format,
        parser_name=invoice.parser_name,
        warnings_count=len(invoice.warnings or []),
        is_synthetic=bool(invoice.is_synthetic),
        created_at=invoice.created_at
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter_by(id=id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    db.delete(invoice)
    db.commit()
    return None

@router.get("/{id}/line-items", response_model=LineItemsPaginatedResponse)
def get_invoice_line_items(
    id: str,
    query: Optional[str] = Query(None),
    account: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    show_info: bool = Query(True),
    sort_by: str = Query("row_index"),
    sort_dir: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter_by(id=id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    q = db.query(LineItem).filter_by(invoice_id=id)

    # Distinct accounts for filter dropdown
    distinct_accounts = [r[0] for r in db.query(LineItem.account).filter_by(invoice_id=id).distinct().order_by(LineItem.account).all()]

    if not show_info:
        q = q.filter(LineItem.kind != 'info')

    if account:
        q = q.filter(LineItem.account == account)

    if kind:
        q = q.filter(LineItem.kind == kind)

    if query:
        pattern = f"%{query.strip()}%"
        q = q.filter(
            (LineItem.description.ilike(pattern)) |
            (LineItem.sku.ilike(pattern)) |
            (LineItem.account.ilike(pattern))
        )

    # Total sum of filtered items
    all_matching = q.all()
    total_amount = sum((item.line_total for item in all_matching), Decimal('0'))
    total_count = len(all_matching)

    # Sorting
    sort_col = getattr(LineItem, sort_by, LineItem.row_index)
    order_clause = desc(sort_col) if sort_dir.lower() == "desc" else asc(sort_col)
    items = q.order_by(order_clause).offset((page - 1) * page_size).limit(page_size).all()

    item_responses = [
        LineItemResponse(
            id=item.id,
            invoice_id=item.invoice_id,
            row_index=item.row_index,
            account=item.account,
            sku=item.sku,
            description=item.description,
            match_key=item.match_key,
            quantity=str(item.quantity),
            list_price=str(item.list_price) if item.list_price is not None else None,
            unit_cost=str(item.unit_cost),
            line_total=str(item.line_total),
            kind=item.kind,
            raw_data=item.raw_data
        )
        for item in items
    ]

    return LineItemsPaginatedResponse(
        items=item_responses,
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_amount=str(total_amount),
        accounts=distinct_accounts
    )