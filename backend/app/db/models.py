from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.db.custom_types import DecimalString

def generate_uuid():
    return str(uuid.uuid4())

class Vendor(Base):
    __tablename__ = 'vendors'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    invoices = relationship('Invoice', back_populates='vendor', cascade='all, delete-orphan')

class Invoice(Base):
    __tablename__ = 'invoices'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    vendor_id = Column(String(36), ForeignKey('vendors.id', ondelete='CASCADE'), nullable=False, index=True)
    invoice_number = Column(String(100), nullable=True)
    invoice_date = Column(String(20), nullable=True)
    period_from = Column(String(20), nullable=True)
    period_to = Column(String(20), nullable=True)
    period_label = Column(String(50), nullable=False)
    currency = Column(String(10), default='USD', nullable=False)
    declared_total = Column(DecimalString(50), nullable=True)
    computed_total = Column(DecimalString(50), nullable=False)
    source_filename = Column(String(255), nullable=False)
    file_sha256 = Column(String(64), nullable=False, index=True)
    source_format = Column(String(20), nullable=False) # 'csv' or 'pdf'
    parser_name = Column(String(100), nullable=False)
    parser_version = Column(String(20), default='1.0', nullable=False)
    warnings = Column(JSON, default=list, nullable=False)
    is_synthetic = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    vendor = relationship('Vendor', back_populates='invoices')
    line_items = relationship('LineItem', back_populates='invoice', cascade='all, delete-orphan', order_by='LineItem.row_index')

    __table_args__ = (
        UniqueConstraint('vendor_id', 'period_label', name='uq_vendor_period'),
    )

class LineItem(Base):
    __tablename__ = 'line_items'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey('invoices.id', ondelete='CASCADE'), nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    account = Column(String(255), nullable=False, index=True)
    sku = Column(String(255), nullable=True, index=True)
    description = Column(Text, nullable=False)
    match_key = Column(String(500), nullable=False, index=True)
    quantity = Column(DecimalString(50), nullable=False)
    list_price = Column(DecimalString(50), nullable=True)
    unit_cost = Column(DecimalString(50), nullable=False)
    line_total = Column(DecimalString(50), nullable=False)
    kind = Column(String(20), nullable=False, index=True) # 'charge', 'credit', 'info', 'usage'
    raw_data = Column(JSON, nullable=True)

    invoice = relationship('Invoice', back_populates='line_items')
