import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from slugify import slugify
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Invoice, Vendor
from app.api.schemas import InvoiceSummary, VendorCreate, VendorResponse
from app.services.seed import seed_demo_data

router = APIRouter(prefix="/vendors", tags=["vendors"])

def is_admin_enabled() -> bool:
    env_val = os.getenv("ENABLE_ADMIN_ENDPOINTS")
    if env_val is not None:
        return env_val.lower() in ("true", "1", "yes")
    # If not explicitly specified, default to True in test/dev environments, False in production
    if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING", "").lower() in ("true", "1") or os.getenv("ENVIRONMENT", "development").lower() in ("development", "test", "dev"):
        return True
    return False

@router.post("/seed", status_code=status.HTTP_200_OK)
def seed_vendors(db: Session = Depends(get_db)):
    if not is_admin_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin seeding endpoint is disabled. Set ENABLE_ADMIN_ENDPOINTS=true to enable."
        )
    seed_demo_data(db)
    return {"status": "seeded"}



@router.get("", response_model=List[VendorResponse])
def list_vendors(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).order_by(Vendor.name).all()
    results = []
    for v in vendors:
        invoices = db.query(Invoice).filter_by(vendor_id=v.id).order_by(Invoice.period_label.desc()).all()
        inv_summaries = [
            InvoiceSummary(
                id=inv.id,
                vendor_id=inv.vendor_id,
                invoice_number=inv.invoice_number,
                invoice_date=inv.invoice_date,
                period_from=inv.period_from,
                period_to=inv.period_to,
                period_label=inv.period_label,
                currency=inv.currency,
                declared_total=str(inv.declared_total) if inv.declared_total is not None else None,
                computed_total=str(inv.computed_total),
                source_filename=inv.source_filename,
                file_sha256=inv.file_sha256,
                source_format=inv.source_format,
                parser_name=inv.parser_name,
                warnings_count=len(inv.warnings or []),
                is_synthetic=bool(inv.is_synthetic),
                created_at=inv.created_at
            )
            for inv in invoices
        ]

        latest = invoices[0] if invoices else None
        real_invoices = [inv for inv in invoices if not inv.is_synthetic]
        latest_real = real_invoices[0] if real_invoices else None

        results.append(VendorResponse(
            id=v.id,
            name=v.name,
            slug=v.slug,
            created_at=v.created_at,
            invoices_count=len(invoices),
            latest_period=latest.period_label if latest else None,
            latest_total=str(latest.computed_total) if latest else None,
            latest_invoice_id=latest.id if latest else None,
            latest_real_period=latest_real.period_label if latest_real else (latest.period_label if latest else None),
            latest_real_total=str(latest_real.computed_total) if latest_real else (str(latest.computed_total) if latest else None),
            latest_is_synthetic=bool(latest.is_synthetic) if latest else False,
            has_synthetic=any(inv.is_synthetic for inv in invoices),
            invoices=inv_summaries
        ))
    return results

@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Vendor name cannot be empty.")
    slug = slugify(name)

    existing = db.query(Vendor).filter((Vendor.name == name) | (Vendor.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Vendor '{name}' already exists.")

    vendor = Vendor(name=name, slug=slug)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return VendorResponse(
        id=vendor.id,
        name=vendor.name,
        slug=vendor.slug,
        created_at=vendor.created_at,
        invoices_count=0,
        latest_is_synthetic=False,
        has_synthetic=False,
        invoices=[]
    )

@router.get("/{id}", response_model=VendorResponse)
def get_vendor(id: str, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter((Vendor.id == id) | (Vendor.slug == id)).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    invoices = db.query(Invoice).filter_by(vendor_id=vendor.id).order_by(Invoice.period_label.desc()).all()
    inv_summaries = [
        InvoiceSummary(
            id=inv.id,
            vendor_id=inv.vendor_id,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            period_from=inv.period_from,
            period_to=inv.period_to,
            period_label=inv.period_label,
            currency=inv.currency,
            declared_total=str(inv.declared_total) if inv.declared_total is not None else None,
            computed_total=str(inv.computed_total),
            source_filename=inv.source_filename,
            file_sha256=inv.file_sha256,
            source_format=inv.source_format,
            parser_name=inv.parser_name,
            warnings_count=len(inv.warnings or []),
            is_synthetic=bool(inv.is_synthetic),
            created_at=inv.created_at
        )
        for inv in invoices
    ]

    latest = invoices[0] if invoices else None
    real_invoices = [inv for inv in invoices if not inv.is_synthetic]
    latest_real = real_invoices[0] if real_invoices else None

    return VendorResponse(
        id=vendor.id,
        name=vendor.name,
        slug=vendor.slug,
        created_at=vendor.created_at,
        invoices_count=len(invoices),
        latest_period=latest.period_label if latest else None,
        latest_total=str(latest.computed_total) if latest else None,
        latest_invoice_id=latest.id if latest else None,
        latest_real_period=latest_real.period_label if latest_real else (latest.period_label if latest else None),
        latest_real_total=str(latest_real.computed_total) if latest_real else (str(latest.computed_total) if latest else None),
        latest_is_synthetic=bool(latest.is_synthetic) if latest else False,
        has_synthetic=any(inv.is_synthetic for inv in invoices),
        invoices=inv_summaries
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(id: str, db: Session = Depends(get_db)):
    if not is_admin_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Destructive vendor deletion is disabled. Set ENABLE_ADMIN_ENDPOINTS=true to enable."
        )
    vendor = db.query(Vendor).filter((Vendor.id == id) | (Vendor.slug == id)).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    db.delete(vendor)
    db.commit()
    return None