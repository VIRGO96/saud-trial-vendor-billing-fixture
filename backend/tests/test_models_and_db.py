import os
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.db.models import Vendor, Invoice, LineItem
from app.parsers.registry import default_registry
from app.parsers.csv_parser import SherwebCSVParser

def test_db_models_and_decimal_storage():
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    vendor = Vendor(name="Sherweb", slug="sherweb")
    session.add(vendor)
    session.commit()

    invoice = Invoice(
        vendor_id=vendor.id,
        invoice_number="VND-TEST-001",
        invoice_date="2026-07-20",
        period_from="2026-06-21",
        period_to="2026-07-21",
        period_label="2026-07",
        currency="USD",
        declared_total=Decimal('100.50'),
        computed_total=Decimal('100.50'),
        source_filename="test.csv",
        file_sha256="abc123hash",
        source_format="csv",
        parser_name="SherwebCSVParser",
        parser_version="1.0",
        warnings=[]
    )
    session.add(invoice)
    session.commit()

    item = LineItem(
        invoice_id=invoice.id,
        row_index=1,
        account="Acme Corp",
        sku="SKU-001",
        description="Cloud Premium",
        match_key="SKU-001",
        quantity=Decimal('5'),
        list_price=Decimal('25.00'),
        unit_cost=Decimal('20.10'),
        line_total=Decimal('100.50'),
        kind="charge",
        raw_data={"test": "data"}
    )
    session.add(item)
    session.commit()

    # Query back and assert exact Decimal types
    loaded_item = session.query(LineItem).filter_by(sku="SKU-001").first()
    assert loaded_item is not None
    assert isinstance(loaded_item.quantity, Decimal)
    assert loaded_item.quantity == Decimal('5')
    assert isinstance(loaded_item.unit_cost, Decimal)
    assert loaded_item.unit_cost == Decimal('20.10')
    assert isinstance(loaded_item.line_total, Decimal)
    assert loaded_item.line_total == Decimal('100.50')

    loaded_inv = session.query(Invoice).first()
    assert loaded_inv.computed_total == Decimal('100.50')
    assert loaded_inv.declared_total == Decimal('100.50')
    assert len(loaded_inv.line_items) == 1

def test_registry_resolution():
    sample_csv = b'InvoiceNo,Organization,LineTotal,UnitPrice\n1,Org,10,10\n'
    parser, confidence = default_registry.get_best_parser('sample.csv', sample_csv)
    assert isinstance(parser, SherwebCSVParser)
    assert confidence > 0.5