import copy
from decimal import Decimal
import pytest
from app.parsers.base import ParsedLineItem
from app.services.comparison import compare_invoices
from tests.test_comparison import load_sherweb_samples

def test_mutation_quantity_change():
    items_jul, _ = load_sherweb_samples()
    mutated = copy.deepcopy(items_jul)

    # Pick first non-info item
    target = next(i for i in mutated if i.kind == 'charge')
    original_qty = target.quantity
    target.quantity = original_qty + Decimal('5')
    target.line_total = target.quantity * target.unit_cost

    comp = compare_invoices(items_jul, mutated, "Jul", "Aug")
    assert len(comp.changes) == 1
    c = comp.changes[0]
    assert 'QUANTITY_CHANGED' in c.change_types
    assert c.sku == target.sku
    assert c.account == target.account
    assert c.qty_delta == Decimal('5')
    assert comp.reconciled is True

def test_mutation_price_change():
    items_jul, _ = load_sherweb_samples()
    mutated = copy.deepcopy(items_jul)

    target = next(i for i in mutated if i.kind == 'charge')
    target.unit_cost = target.unit_cost + Decimal('2.50')
    target.line_total = target.quantity * target.unit_cost

    comp = compare_invoices(items_jul, mutated, "Jul", "Aug")
    assert len(comp.changes) == 1
    c = comp.changes[0]
    assert 'PRICE_CHANGED' in c.change_types
    assert c.sku == target.sku
    assert c.unit_delta == Decimal('2.50')
    assert comp.reconciled is True

def test_mutation_remove_item():
    items_jul, _ = load_sherweb_samples()
    # Filter out a specific unique item
    target_sku = 'SW-P-O365-8-M1M' # Rosewood
    mutated = [copy.deepcopy(i) for i in items_jul if i.sku != target_sku]

    comp = compare_invoices(items_jul, mutated, "Jul", "Aug")
    removed_items = [c for c in comp.changes if 'REMOVED' in c.change_types]
    assert any(c.sku == target_sku for c in removed_items)
    assert comp.reconciled is True

def test_mutation_add_item():
    items_jul, _ = load_sherweb_samples()
    mutated = copy.deepcopy(items_jul)
    new_item = ParsedLineItem(
        row_index=999,
        account="New Corp",
        sku="SKU-BRAND-NEW",
        description="Brand New Subscription",
        match_key="SKU-BRAND-NEW",
        quantity=Decimal('10'),
        list_price=Decimal('15.00'),
        unit_cost=Decimal('12.00'),
        line_total=Decimal('120.00'),
        kind="charge",
        raw_data={}
    )
    mutated.append(new_item)

    comp = compare_invoices(items_jul, mutated, "Jul", "Aug")
    new_changes = [c for c in comp.changes if 'NEW' in c.change_types]
    assert len(new_changes) == 1
    assert new_changes[0].sku == "SKU-BRAND-NEW"
    assert new_changes[0].amount_delta == Decimal('120.00')
    assert comp.reconciled is True

def test_mutation_credit_row_adjustment():
    items_jul, _ = load_sherweb_samples()
    mutated = copy.deepcopy(items_jul)

    # Add a credit row for an existing account and SKU
    target = next(i for i in mutated if i.kind == 'charge')
    credit_row = ParsedLineItem(
        row_index=1000,
        account=target.account,
        sku=target.sku,
        description=target.description,
        match_key=target.match_key,
        quantity=Decimal('-2'),
        list_price=target.list_price,
        unit_cost=target.unit_cost,
        line_total=Decimal('-2') * target.unit_cost,
        kind="credit",
        raw_data={}
    )
    mutated.append(credit_row)

    comp = compare_invoices(items_jul, mutated, "Jul", "Aug")
    assert len(comp.changes) == 1
    c = comp.changes[0]
    assert 'QUANTITY_CHANGED' in c.change_types
    assert c.net_qty_delta == Decimal('-2')
    # Headline quantity stays unchanged because primary charge row wasn't altered
    assert c.qty_delta == Decimal('0')
    assert comp.reconciled is True

def test_mutation_row_reordering():
    items_jul, _ = load_sherweb_samples()
    # Reverse rows
    reordered = list(reversed(copy.deepcopy(items_jul)))

    comp = compare_invoices(items_jul, reordered, "Jul", "Aug")
    assert len(comp.changes) == 0
    assert comp.reconciled is True