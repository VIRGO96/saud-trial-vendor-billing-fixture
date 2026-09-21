from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Invoice, LineItem, Vendor
from app.services.comparison import compare_invoices
from app.services.exporter import export_changes_to_csv, export_changes_to_xlsx
from app.api.schemas import ChangeRecordResponse, ComparisonResponse

router = APIRouter(prefix="/vendors", tags=["comparison"])

def _get_comparison_summary(
    vendor_id: str,
    from_id: Optional[str],
    to_id: Optional[str],
    db: Session
):
    vendor = db.query(Vendor).filter((Vendor.id == vendor_id) | (Vendor.slug == vendor_id)).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    invoices = db.query(Invoice).filter_by(vendor_id=vendor.id).order_by(Invoice.period_label.asc()).all()
    if len(invoices) < 2 and (not from_id or not to_id):
        raise HTTPException(
            status_code=400,
            detail=f"Vendor '{vendor.name}' has fewer than 2 invoices. Please upload at least 2 periods to compare."
        )

    inv_from = None
    inv_to = None

    if from_id:
        inv_from = db.query(Invoice).filter_by(id=from_id, vendor_id=vendor.id).first()
        if not inv_from:
            raise HTTPException(status_code=404, detail=f"From-invoice '{from_id}' not found for this vendor.")
    if to_id:
        inv_to = db.query(Invoice).filter_by(id=to_id, vendor_id=vendor.id).first()
        if not inv_to:
            raise HTTPException(status_code=404, detail=f"To-invoice '{to_id}' not found for this vendor.")

    if not inv_from or not inv_to:
        inv_from = invoices[-2]
        inv_to = invoices[-1]

    items_from = db.query(LineItem).filter_by(invoice_id=inv_from.id).all()
    items_to = db.query(LineItem).filter_by(invoice_id=inv_to.id).all()

    summary = compare_invoices(
        items_from=items_from,
        items_to=items_to,
        period_from_label=inv_from.period_label,
        period_to_label=inv_to.period_label,
        vendor_id=vendor.id,
        invoice_from_id=inv_from.id,
        invoice_to_id=inv_to.id
    )

    return vendor, inv_from, inv_to, summary

@router.get("/{id}/compare", response_model=ComparisonResponse)
def compare_vendor_invoices(
    id: str,
    from_invoice: Optional[str] = Query(None, alias="from"),
    to_invoice: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db)
):
    vendor, inv_from, inv_to, summary = _get_comparison_summary(id, from_invoice, to_invoice, db)

    change_responses = [
        ChangeRecordResponse(
            account=c.account,
            sku=c.sku,
            description=c.description,
            kind=c.kind,
            change_types=c.change_types,
            qty_from=str(c.qty_from) if c.qty_from is not None else None,
            qty_to=str(c.qty_to) if c.qty_to is not None else None,
            qty_delta=str(c.qty_delta),
            net_qty_from=str(c.net_qty_from) if c.net_qty_from is not None else None,
            net_qty_to=str(c.net_qty_to) if c.net_qty_to is not None else None,
            net_qty_delta=str(c.net_qty_delta),
            unit_from=str(c.unit_from) if c.unit_from is not None else None,
            unit_to=str(c.unit_to) if c.unit_to is not None else None,
            unit_delta=str(c.unit_delta),
            unit_delta_pct=str(c.unit_delta_pct) if c.unit_delta_pct is not None else None,
            amount_from=str(c.amount_from) if c.amount_from is not None else None,
            amount_to=str(c.amount_to) if c.amount_to is not None else None,
            amount_delta=str(c.amount_delta),
            notes=c.notes,
            rows_from=[
                {
                    'row_index': r['row_index'],
                    'account': r['account'],
                    'sku': r['sku'],
                    'description': r['description'],
                    'quantity': str(r['quantity']),
                    'unit_cost': str(r['unit_cost']),
                    'line_total': str(r['line_total']),
                    'kind': r['kind']
                }
                for r in c.rows_from
            ],
            rows_to=[
                {
                    'row_index': r['row_index'],
                    'account': r['account'],
                    'sku': r['sku'],
                    'description': r['description'],
                    'quantity': str(r['quantity']),
                    'unit_cost': str(r['unit_cost']),
                    'line_total': str(r['line_total']),
                    'kind': r['kind']
                }
                for r in c.rows_to
            ]
        )
        for c in summary.changes
    ]

    return ComparisonResponse(
        vendor_id=vendor.id,
        vendor_name=vendor.name,
        period_from=summary.period_from,
        period_to=summary.period_to,
        invoice_from_id=summary.invoice_from_id,
        invoice_to_id=summary.invoice_to_id,
        is_synthetic_from=bool(inv_from.is_synthetic) if inv_from else False,
        is_synthetic_to=bool(inv_to.is_synthetic) if inv_to else False,
        total_from=str(summary.total_from),
        total_to=str(summary.total_to),
        net_delta=str(summary.net_delta),
        counts_by_type=summary.counts_by_type,
        reconciled=summary.reconciled,
        reconciliation_difference=str(summary.reconciliation_difference),
        changes=change_responses,
        unchanged_count=summary.unchanged_count
    )

@router.get("/{id}/compare/export")
def export_comparison(
    id: str,
    from_invoice: Optional[str] = Query(None, alias="from"),
    to_invoice: Optional[str] = Query(None, alias="to"),
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    db: Session = Depends(get_db)
):
    vendor, inv_from, inv_to, summary = _get_comparison_summary(id, from_invoice, to_invoice, db)

    filename_base = f"{vendor.slug}-diff-{summary.period_from}-to-{summary.period_to}"

    if format == "xlsx":
        content = export_changes_to_xlsx(summary, vendor_name=vendor.name)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{filename_base}.xlsx"
    else:
        content = export_changes_to_csv(summary, vendor_name=vendor.name)
        media_type = "text/csv; charset=utf-8"
        filename = f"{filename_base}.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )