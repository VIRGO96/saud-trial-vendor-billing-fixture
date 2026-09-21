import hashlib
import os
from decimal import Decimal
from slugify import slugify
from sqlalchemy.orm import Session

from app.db.database import SessionLocal, init_db
from app.db.models import Vendor, Invoice, LineItem
from app.parsers.registry import default_registry

def seed_demo_data(db: Session = None) -> None:
    close_db = False
    if db is None:
        init_db()
        db = SessionLocal()
        close_db = True

    candidate_samples = [
        os.getenv('SAMPLES_DIR'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'samples'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'samples'),
        '/app/samples',
        './samples',
        '../samples',
    ]
    samples_dir = next((d for d in candidate_samples if d and os.path.exists(d)), './samples')

    candidate_fixtures = [
        os.getenv('FIXTURES_DIR'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'fixtures', 'generated'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'fixtures', 'generated'),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'fixtures'),
        '/app/fixtures/generated',
        '/app/fixtures',
        './fixtures/generated',
        './fixtures',
    ]
    fixtures_dir = next((d for d in candidate_fixtures if d and os.path.exists(d)), './fixtures/generated')

    files_to_seed = [
        ('Sherweb', 'vendor-sherweb-2026-07.csv', samples_dir),
        ('Sherweb', 'vendor-sherweb-2026-08.csv', samples_dir),
        ('PowerDMARC', 'vendor-powerdmarc-2026-08.pdf', samples_dir),
        ('PowerDMARC', 'powerdmarc-2026-09-SYNTHETIC.pdf', fixtures_dir),
    ]

    try:
        for vendor_name, filename, folder in files_to_seed:
            file_path = os.path.join(folder, filename)
            if not os.path.exists(file_path):
                file_path = os.path.join(folder, 'generated', filename)
            if not os.path.exists(file_path):
                continue

            # Ensure Vendor exists
            slug = slugify(vendor_name)
            vendor = db.query(Vendor).filter_by(slug=slug).first()
            if not vendor:
                vendor = Vendor(name=vendor_name, slug=slug)
                db.add(vendor)
                db.commit()
                db.refresh(vendor)

            with open(file_path, 'rb') as f:
                content = f.read()

            file_hash = hashlib.sha256(content).hexdigest()

            # Parse content
            parse_result = default_registry.parse(filename, content)
            period_label = parse_result.invoice_meta.period_label

            # Check if invoice already exists
            existing = db.query(Invoice).filter_by(vendor_id=vendor.id, period_label=period_label).first()
            if existing:
                continue

            invoice = Invoice(
                vendor_id=vendor.id,
                invoice_number=parse_result.invoice_meta.invoice_number,
                invoice_date=parse_result.invoice_meta.invoice_date,
                period_from=parse_result.invoice_meta.period_from,
                period_to=parse_result.invoice_meta.period_to,
                period_label=period_label,
                currency=parse_result.invoice_meta.currency,
                declared_total=parse_result.invoice_meta.declared_total,
                computed_total=parse_result.computed_total,
                source_filename=filename,
                file_sha256=file_hash,
                source_format=parse_result.invoice_meta.source_format,
                parser_name=parse_result.parser_name,
                parser_version=parse_result.parser_version,
                is_synthetic=('synthetic' in filename.lower()),
                warnings=[{'row_index': w.row_index, 'message': w.message, 'severity': w.severity} for w in parse_result.warnings]
            )
            db.add(invoice)
            db.commit()
            db.refresh(invoice)

            # Add line items
            line_item_objs = []
            for item in parse_result.line_items:
                line_item_objs.append(LineItem(
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
                ))

            db.bulk_save_objects(line_item_objs)
            db.commit()

        print("Demo seeding completed successfully.")
    finally:
        if close_db:
            db.close()