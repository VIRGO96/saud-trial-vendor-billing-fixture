import io
import os
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app
from app.services.seed import seed_demo_data

def get_sample_path(filename: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'samples', filename)

@pytest.fixture(scope="module")
def client():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": "1.0.0"}

def test_preview_and_upload_flow(client):
    jul_path = get_sample_path('vendor-sherweb-2026-07.csv')
    with open(jul_path, 'rb') as f:
        jul_bytes = f.read()

    # 1. Preview
    res_prev = client.post(
        "/api/invoices/preview",
        files={"file": ("vendor-sherweb-2026-07.csv", jul_bytes, "text/csv")}
    )
    assert res_prev.status_code == 200
    pdata = res_prev.json()
    assert pdata['vendor_guess'] == "Sherweb"
    assert pdata['line_count'] == 245
    assert pdata['computed_total'] == "20362.51"
    assert pdata['period_label'] == "2026-07"
    assert len(pdata['preview_rows']) > 0

    # 2. Upload July
    res_up1 = client.post(
        "/api/invoices",
        files={"file": ("vendor-sherweb-2026-07.csv", jul_bytes, "text/csv")},
        data={"vendor_name": "Sherweb", "period_label": "2026-07", "replace": "false"}
    )
    assert res_up1.status_code == 201
    inv1_data = res_up1.json()
    inv1_id = inv1_data['id']
    vendor_id = inv1_data['vendor_id']

    # 3. Duplicate Upload -> 409 Conflict
    res_dup = client.post(
        "/api/invoices",
        files={"file": ("vendor-sherweb-2026-07.csv", jul_bytes, "text/csv")},
        data={"vendor_id": vendor_id, "period_label": "2026-07", "replace": "false"}
    )
    assert res_dup.status_code == 409
    assert res_dup.json()['detail']['conflict_type'] in ("hash", "period")

    # 3b. Replace flow
    res_rep = client.post(
        "/api/invoices",
        files={"file": ("vendor-sherweb-2026-07.csv", jul_bytes, "text/csv")},
        data={"vendor_id": vendor_id, "period_label": "2026-07", "replace": "true"}
    )
    assert res_rep.status_code == 201
    inv1_id = res_rep.json()['id']

    # 4. Upload August
    aug_path = get_sample_path('vendor-sherweb-2026-08.csv')
    with open(aug_path, 'rb') as f:
        aug_bytes = f.read()

    res_up2 = client.post(
        "/api/invoices",
        files={"file": ("vendor-sherweb-2026-08.csv", aug_bytes, "text/csv")},
        data={"vendor_id": vendor_id, "period_label": "2026-08", "replace": "false"}
    )
    assert res_up2.status_code == 201
    inv2_id = res_up2.json()['id']

    # 5. List vendors & get vendor
    res_v = client.get("/api/vendors")
    assert res_v.status_code == 200
    v_list = res_v.json()
    assert len(v_list) >= 1
    sherweb_v = next(v for v in v_list if v['name'] == "Sherweb")
    assert sherweb_v['invoices_count'] == 2

    res_v_single = client.get(f"/api/vendors/{vendor_id}")
    assert res_v_single.status_code == 200
    assert res_v_single.json()['name'] == "Sherweb"

    # 6. Line items pagination & filtering
    res_li = client.get(f"/api/invoices/{inv1_id}/line-items?page=1&page_size=20&account=Internal Lab")
    assert res_li.status_code == 200
    li_data = res_li.json()
    assert li_data['total_count'] > 0
    assert all(item['account'] == "Internal Lab" for item in li_data['items'])

    # Test sorting and search
    res_li_sort = client.get(f"/api/invoices/{inv1_id}/line-items?query=Teams&sort_by=line_total&sort_dir=desc")
    assert res_li_sort.status_code == 200
    assert res_li_sort.json()['total_count'] > 0

    # 7. Comparison endpoint
    res_comp = client.get(f"/api/vendors/{vendor_id}/compare?from={inv1_id}&to={inv2_id}")
    assert res_comp.status_code == 200
    cdata = res_comp.json()
    assert len(cdata['changes']) == 6
    assert cdata['reconciled'] is True
    assert cdata['net_delta'] == "620.46"

    # 8. Single invoice get
    res_inv = client.get(f"/api/invoices/{inv1_id}")
    assert res_inv.status_code == 200
    assert res_inv.json()['computed_total'] == "20362.51"

def test_compare_export_api(client):
    res_v = client.get("/api/vendors")
    sherweb_v = next(v for v in res_v.json() if v['name'] == "Sherweb")
    v_id = sherweb_v['id']

    # Export CSV
    res_csv = client.get(f"/api/vendors/{v_id}/compare/export?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert res_csv.content.startswith(b'\xef\xbb\xbf')
    csv_text = res_csv.content.decode('utf-8-sig')
    assert "Bayview Clinic" in csv_text
    assert "Saltbox Kitchen" in csv_text

    # Export XLSX
    res_xlsx = client.get(f"/api/vendors/{v_id}/compare/export?format=xlsx")
    assert res_xlsx.status_code == 200
    assert "spreadsheetml" in res_xlsx.headers["content-type"]
    assert len(res_xlsx.content) > 1000

def test_vendor_create_and_invoice_delete(client):
    res_create = client.post("/api/vendors", json={"name": "Acme Cloud Vendor"})
    assert res_create.status_code == 201
    v_id = res_create.json()['id']

    # Upload PDF for Acme
    pdf_path = get_sample_path('vendor-powerdmarc-2026-08.pdf')
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()

    res_up = client.post(
        "/api/invoices",
        files={"file": ("vendor-powerdmarc-2026-08.pdf", pdf_bytes, "application/pdf")},
        data={"vendor_id": v_id, "period_label": "2026-08"}
    )
    assert res_up.status_code == 201
    inv_id = res_up.json()['id']

    # Delete invoice
    res_del = client.delete(f"/api/invoices/{inv_id}")
    assert res_del.status_code == 204

    # Confirm 404
    assert client.get(f"/api/invoices/{inv_id}").status_code == 404

def test_vendor_create_and_validation_errors(client):
    # Empty name -> 400
    res_empty = client.post("/api/vendors", json={"name": "   "})
    assert res_empty.status_code == 400

    # Create new vendor
    res_v = client.post("/api/vendors", json={"name": "Zeta Security"})
    assert res_v.status_code == 201
    z_id = res_v.json()['id']

    # Duplicate vendor name -> 409
    res_dup = client.post("/api/vendors", json={"name": "Zeta Security"})
    assert res_dup.status_code == 409

    # Unknown vendor ID -> 404
    res_nf = client.get("/api/vendors/non-existent-vendor-id-12345")
    assert res_nf.status_code == 404

    # Delete non-existent vendor -> 404
    res_del_nf = client.delete("/api/vendors/non-existent-vendor-id-12345")
    assert res_del_nf.status_code == 404

    # Delete existing vendor -> 204
    res_del = client.delete(f"/api/vendors/{z_id}")
    assert res_del.status_code == 204

    # Confirm deleted -> 404
    assert client.get(f"/api/vendors/{z_id}").status_code == 404

def test_seed_and_admin_guards(client, monkeypatch):
    # Test seed endpoint when enabled
    res_seed = client.post("/api/vendors/seed")
    assert res_seed.status_code == 200
    assert res_seed.json() == {"status": "seeded"}

    # Test when ENABLE_ADMIN_ENDPOINTS=false
    monkeypatch.setenv("ENABLE_ADMIN_ENDPOINTS", "false")
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    res_seed_blocked = client.post("/api/vendors/seed")
    assert res_seed_blocked.status_code == 403

    res_del_blocked = client.delete("/api/vendors/some-id")
    assert res_del_blocked.status_code == 403

    # Restore environment
    monkeypatch.setenv("ENABLE_ADMIN_ENDPOINTS", "true")


def test_seeding_service():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    Session = sessionmaker(bind=test_engine)
    session = Session()

    seed_demo_data(session)

    # Assert seeded data exists
    vendors = session.query(Base.metadata.tables['vendors']).all()
    assert len(vendors) >= 2 # Sherweb & PowerDMARC
    invoices = session.query(Base.metadata.tables['invoices']).all()
    assert len(invoices) >= 3 # Sherweb 07, Sherweb 08, PowerDMARC 08
    session.close()

def test_no_descriptions_start_with_digit_space(client):
    import re
    # Check all line items across all invoices
    res_v = client.get("/api/vendors")
    assert res_v.status_code == 200
    for vendor in res_v.json():
        for inv in vendor['invoices']:
            res_items = client.get(f"/api/invoices/{inv['id']}/line-items?page_size=300")
            assert res_items.status_code == 200
            for item in res_items.json()['items']:
                desc = item['description']
                assert not re.match(r'^\d+\s+', desc), f"Line item description '{desc}' starts with digit + space!"
                assert not re.match(r'^\d+[.:-]\s+', desc), f"Line item description '{desc}' starts with digit + delimiter + space!"

        # Check compare changes
        if len(vendor['invoices']) >= 2:
            inv_from = vendor['invoices'][1]['id']
            inv_to = vendor['invoices'][0]['id']
            res_comp = client.get(f"/api/vendors/{vendor['id']}/compare?from={inv_from}&to={inv_to}")
            assert res_comp.status_code == 200
            for change in res_comp.json()['changes']:
                desc = change['description']
                assert not re.match(r'^\d+\s+', desc), f"Compare change description '{desc}' starts with digit + space!"
                assert not re.match(r'^\d+[.:-]\s+', desc), f"Compare change description '{desc}' starts with digit + delimiter + space!"