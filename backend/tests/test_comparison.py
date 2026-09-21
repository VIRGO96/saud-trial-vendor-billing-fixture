import os
from decimal import Decimal
import pytest
from app.parsers.csv_parser import SherwebCSVParser
from app.services.comparison import compare_invoices

def get_sample_path(filename: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'samples', filename)

def load_sherweb_samples():
    parser = SherwebCSVParser()
    with open(get_sample_path('vendor-sherweb-2026-07.csv'), 'rb') as f:
        res_jul = parser.parse(f.read(), 'vendor-sherweb-2026-07.csv')
    with open(get_sample_path('vendor-sherweb-2026-08.csv'), 'rb') as f:
        res_aug = parser.parse(f.read(), 'vendor-sherweb-2026-08.csv')
    return res_jul.line_items, res_aug.line_items

def test_sherweb_ground_truth_diff():
    items_jul, items_aug = load_sherweb_samples()
    comp = compare_invoices(items_jul, items_aug, "2026-07", "2026-08")

    # Assert exactly 6 changes
    assert len(comp.changes) == 6, f"Expected exactly 6 changes, got {len(comp.changes)}"
    assert comp.reconciled is True
    assert comp.net_delta == Decimal('620.46')
    assert comp.counts_by_type['UNCHANGED'] == 163
    assert comp.unchanged_count == 163
    assert comp.counts_by_type['PRICE_CHANGED'] == 2
    assert comp.counts_by_type['QUANTITY_CHANGED'] == 2
    assert comp.counts_by_type['NEW'] == 1
    assert comp.counts_by_type['REMOVED'] == 1

    # Build lookup by (account, sku)
    by_key = {(c.account, c.sku): c for c in comp.changes}

    # 1. Bayview Clinic: Quantity changed (headline 12 -> 5, net 13 -> 6)
    c1 = by_key.get(('Bayview Clinic', 'SW-P-O365-13-A-M1M'))
    assert c1 is not None
    assert set(c1.change_types) == {'QUANTITY_CHANGED'}
    assert c1.qty_from == Decimal('12')
    assert c1.qty_to == Decimal('5')
    assert c1.qty_delta == Decimal('-7')
    assert c1.net_qty_from == Decimal('13')
    assert c1.net_qty_to == Decimal('6')
    assert c1.net_qty_delta == Decimal('-7')
    assert c1.unit_from == Decimal('14.40')
    assert c1.unit_to == Decimal('14.40')
    assert c1.amount_delta == Decimal('-100.80')

    # 2. Harbor 360: Price changed
    c2 = by_key.get(('Harbor 360', 'SW-P-O365-25-A-M1M'))
    assert c2 is not None
    assert set(c2.change_types) == {'PRICE_CHANGED'}
    assert c2.qty_from == Decimal('18')
    assert c2.qty_to == Decimal('18')
    assert c2.qty_delta == Decimal('0')
    assert c2.unit_from == Decimal('9.50')
    assert c2.unit_to == Decimal('9.84')
    assert c2.unit_delta == Decimal('0.34')
    assert c2.amount_delta == Decimal('6.12')

    # 3. Meridian Live: Price changed
    c3 = by_key.get(('Meridian Live', 'SW-P-O365-15-M1M'))
    assert c3 is not None
    assert set(c3.change_types) == {'PRICE_CHANGED'}
    assert c3.qty_from == Decimal('249')
    assert c3.qty_to == Decimal('249')
    assert c3.qty_delta == Decimal('0')
    assert c3.unit_from == Decimal('21.10')
    assert c3.unit_to == Decimal('21.648')
    assert c3.unit_delta == Decimal('0.548')
    assert c3.amount_delta == Decimal('136.45')

    # 4. Rosewood Pictures: Removed
    c4 = by_key.get(('Rosewood Pictures', 'SW-P-O365-8-M1M'))
    assert c4 is not None
    assert set(c4.change_types) == {'REMOVED'}
    assert c4.qty_from == Decimal('2')
    assert c4.qty_to is None
    assert c4.unit_from == Decimal('7.872')
    assert c4.unit_to is None
    assert c4.amount_delta == Decimal('-15.74')

    # 5. Saltbox Kitchen: New
    c5 = by_key.get(('Saltbox Kitchen', 'SW-P-O365-324-M1Y'))
    assert c5 is not None
    assert set(c5.change_types) == {'NEW'}
    assert c5.qty_from is None
    assert c5.qty_to == Decimal('48')
    assert c5.unit_from is None
    assert c5.unit_to == Decimal('17.9088')
    assert c5.amount_delta == Decimal('859.62')

    # 6. Tandem Staffing: Quantity changed
    c6 = by_key.get(('Tandem Staffing', 'SW-P-O365-15-M1Y'))
    assert c6 is not None
    assert set(c6.change_types) == {'QUANTITY_CHANGED'}
    assert c6.qty_from == Decimal('86')
    assert c6.qty_to == Decimal('72')
    assert c6.qty_delta == Decimal('-14')
    assert c6.unit_from == Decimal('18.942')
    assert c6.unit_to == Decimal('18.942')
    assert c6.amount_delta == Decimal('-265.19')

    # Sum of the 6 deltas must match total net delta (+620.46)
    assert sum(c.amount_delta for c in comp.changes) == Decimal('620.46')

def test_self_comparison_invariance():
    items_jul, _ = load_sherweb_samples()
    comp = compare_invoices(items_jul, items_jul, "2026-07", "2026-07")
    assert len(comp.changes) == 0
    assert comp.net_delta == Decimal('0')
    assert comp.reconciled is True
    assert comp.counts_by_type['UNCHANGED'] == 168
    assert comp.unchanged_count == 168

def test_swap_symmetry():
    items_jul, items_aug = load_sherweb_samples()
    comp_fwd = compare_invoices(items_jul, items_aug, "2026-07", "2026-08")
    comp_rev = compare_invoices(items_aug, items_jul, "2026-08", "2026-07")

    assert len(comp_fwd.changes) == len(comp_rev.changes) == 6
    assert comp_fwd.net_delta == -comp_rev.net_delta
    assert comp_fwd.counts_by_type['UNCHANGED'] == comp_rev.counts_by_type['UNCHANGED'] == 163

    rev_lookup = {(c.account, c.sku): c for c in comp_rev.changes}
    for c in comp_fwd.changes:
        rev_c = rev_lookup[(c.account, c.sku)]
        assert c.amount_delta == -rev_c.amount_delta
        if c.qty_delta is not None and rev_c.qty_delta is not None:
            assert c.qty_delta == -rev_c.qty_delta
        if c.net_qty_delta is not None and rev_c.net_qty_delta is not None:
            assert c.net_qty_delta == -rev_c.net_qty_delta
        if c.unit_delta is not None and rev_c.unit_delta is not None:
            assert c.unit_delta == -rev_c.unit_delta
        if 'NEW' in c.change_types:
            assert set(rev_c.change_types) == {'REMOVED'}
        elif 'REMOVED' in c.change_types:
            assert set(rev_c.change_types) == {'NEW'}
        elif 'PRICE_CHANGED' in c.change_types:
            assert set(rev_c.change_types) == {'PRICE_CHANGED'}
        elif 'QUANTITY_CHANGED' in c.change_types:
            assert set(rev_c.change_types) == {'QUANTITY_CHANGED'}

def test_comparison_dict_items():
    dict_items_from = [
        {
            "account": "Corp A",
            "sku": "SKU-1",
            "match_key": "corp-a-sku-1",
            "description": "Product 1",
            "quantity": "5",
            "list_price": "10.00",
            "unit_cost": "8.00",
            "line_total": "40.00",
            "kind": "charge",
            "row_index": 1,
            "raw_data": {"test": 123}
        }
    ]
    dict_items_to = [
        {
            "account": "Corp A",
            "sku": "SKU-1",
            "match_key": "corp-a-sku-1",
            "description": "Product 1",
            "quantity": "8",
            "list_price": "10.00",
            "unit_cost": "9.00",
            "line_total": "72.00",
            "kind": "charge",
            "row_index": 1,
            "raw_data": {"test": 123}
        }
    ]
    comp = compare_invoices(dict_items_from, dict_items_to, "2026-01", "2026-02")
    assert len(comp.changes) == 1
    assert set(comp.changes[0].change_types) == {"PRICE_CHANGED", "QUANTITY_CHANGED"}
    assert comp.changes[0].amount_delta == Decimal("32.00")

def test_comparison_usage_items():
    from_items = [
        {
            "account": "Corp U",
            "description": "Cloud Compute Usage",
            "match_key": "corp-u-cloud-compute",
            "quantity": "1",
            "unit_cost": "100.00",
            "line_total": "100.00",
            "kind": "usage",
        }
    ]
    to_items = [
        {
            "account": "Corp U",
            "description": "Cloud Compute Usage",
            "match_key": "corp-u-cloud-compute",
            "quantity": "1",
            "unit_cost": "150.00",
            "line_total": "150.00",
            "kind": "usage",
        }
    ]
    comp = compare_invoices(from_items, to_items, "2026-01", "2026-02")
    assert len(comp.changes) == 1
    assert set(comp.changes[0].change_types) == {"USAGE_CHANGED"}
    assert comp.changes[0].amount_delta == Decimal("50.00")