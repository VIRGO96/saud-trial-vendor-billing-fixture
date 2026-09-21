from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

@dataclass
class GroupSummary:
    account: str
    item_key: str
    sku: Optional[str]
    description: str
    kind: str # 'charge', 'credit', 'usage'
    net_qty: Decimal
    headline_qty: Decimal
    headline_unit: Decimal
    amount: Decimal
    tier_note: Optional[str] = None
    rows: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ChangeRecord:
    account: str
    sku: Optional[str]
    description: str
    kind: str
    change_types: List[str] # NEW, REMOVED, PRICE_CHANGED, QUANTITY_CHANGED, USAGE_CHANGED, UNCHANGED
    qty_from: Optional[Decimal]
    qty_to: Optional[Decimal]
    qty_delta: Decimal
    net_qty_from: Optional[Decimal]
    net_qty_to: Optional[Decimal]
    net_qty_delta: Decimal
    unit_from: Optional[Decimal]
    unit_to: Optional[Decimal]
    unit_delta: Decimal
    unit_delta_pct: Optional[Decimal]
    amount_from: Optional[Decimal]
    amount_to: Optional[Decimal]
    amount_delta: Decimal
    notes: List[str] = field(default_factory=list)
    rows_from: List[Dict[str, Any]] = field(default_factory=list)
    rows_to: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ComparisonSummary:
    vendor_id: Optional[str]
    period_from: str
    period_to: str
    invoice_from_id: Optional[str]
    invoice_to_id: Optional[str]
    total_from: Decimal
    total_to: Decimal
    net_delta: Decimal
    counts_by_type: Dict[str, int]
    reconciled: bool
    reconciliation_difference: Decimal
    changes: List[ChangeRecord]
    unchanged_count: int

def normalize_key(account: str, sku: Optional[str], match_key: str) -> Tuple[str, str]:
    acc = (account or '').strip()
    if sku and sku.strip():
        item = sku.upper().strip()
    else:
        item = (match_key or '').strip()
    return (acc, item)

def group_line_items(items: List[Any]) -> Dict[Tuple[str, str], GroupSummary]:
    groups: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for item in items:
        # Extract fields whether dict, Pydantic model, or SQLAlchemy LineItem
        if isinstance(item, dict):
            account = item.get('account', '')
            sku = item.get('sku')
            match_key = item.get('match_key', '')
            description = item.get('description', '')
            qty = Decimal(str(item.get('quantity', '0')))
            list_price = Decimal(str(item['list_price'])) if item.get('list_price') is not None else None
            unit_cost = Decimal(str(item.get('unit_cost', '0')))
            line_total = Decimal(str(item.get('line_total', '0')))
            kind = item.get('kind', 'charge')
            raw_data = item.get('raw_data') or {}
            row_idx = item.get('row_index', 0)
        else:
            account = getattr(item, 'account', '')
            sku = getattr(item, 'sku', None)
            match_key = getattr(item, 'match_key', '')
            description = getattr(item, 'description', '')
            qty = Decimal(str(getattr(item, 'quantity', '0')))
            lp_raw = getattr(item, 'list_price', None)
            list_price = Decimal(str(lp_raw)) if lp_raw is not None else None
            unit_cost = Decimal(str(getattr(item, 'unit_cost', '0')))
            line_total = Decimal(str(getattr(item, 'line_total', '0')))
            kind = getattr(item, 'kind', 'charge')
            raw_data = getattr(item, 'raw_data', {}) or {}
            row_idx = getattr(item, 'row_index', 0)

        # Skip info rows from grouping/diffing
        if kind == 'info':
            continue

        key = normalize_key(account, sku, match_key)
        tier_note = raw_data.get('tier_note') if isinstance(raw_data, dict) else None

        if key not in groups:
            groups[key] = {
                'account': account,
                'item_key': key[1],
                'sku': sku,
                'description': description,
                'kind': kind,
                'tier_note': tier_note,
                'rows': []
            }

        groups[key]['rows'].append({
            'row_index': row_idx,
            'account': account,
            'sku': sku,
            'description': description,
            'quantity': qty,
            'list_price': list_price,
            'unit_cost': unit_cost,
            'line_total': line_total,
            'kind': kind,
            'raw_data': raw_data,
        })

    # Build summaries
    summaries: Dict[Tuple[str, str], GroupSummary] = {}
    for key, g in groups.items():
        rows = g['rows']
        net_qty = sum((r['quantity'] for r in rows), Decimal('0'))
        amount = sum((r['line_total'] for r in rows), Decimal('0'))

        # Determine dominant kind (if usage SKU, usage; else charge)
        dominant_kind = 'usage' if any(r['kind'] == 'usage' for r in rows) else 'charge'

        # Select primary row: charge row with largest positive qty; tie -> largest line_total
        charge_rows = [r for r in rows if r['kind'] in ('charge', 'usage') and r['quantity'] > Decimal('0')]
        if not charge_rows:
            charge_rows = rows
        primary = max(charge_rows, key=lambda r: (r['quantity'], r['line_total']))

        summaries[key] = GroupSummary(
            account=g['account'],
            item_key=g['item_key'],
            sku=g['sku'],
            description=primary['description'],
            kind=dominant_kind,
            net_qty=net_qty,
            headline_qty=primary['quantity'],
            headline_unit=primary['unit_cost'],
            amount=amount,
            tier_note=g['tier_note'],
            rows=rows
        )

    return summaries

def compare_invoices(
    items_from: List[Any],
    items_to: List[Any],
    period_from_label: str = "From Period",
    period_to_label: str = "To Period",
    vendor_id: Optional[str] = None,
    invoice_from_id: Optional[str] = None,
    invoice_to_id: Optional[str] = None
) -> ComparisonSummary:
    g_from = group_line_items(items_from)
    g_to = group_line_items(items_to)

    all_keys = set(g_from.keys()) | set(g_to.keys())
    changes: List[ChangeRecord] = []
    unchanged_count = 0

    counts = {
        'NEW': 0,
        'REMOVED': 0,
        'PRICE_CHANGED': 0,
        'QUANTITY_CHANGED': 0,
        'USAGE_CHANGED': 0,
        'UNCHANGED': 0
    }

    # Group amount sums over participating items
    total_from = sum((g.amount for g in g_from.values()), Decimal('0'))
    total_to = sum((g.amount for g in g_to.values()), Decimal('0'))
    net_delta = total_to - total_from

    for key in sorted(all_keys):
        in_from = key in g_from
        in_to = key in g_to

        if not in_from and in_to:
            item_to = g_to[key]
            record = ChangeRecord(
                account=item_to.account,
                sku=item_to.sku,
                description=item_to.description,
                kind=item_to.kind,
                change_types=['NEW'],
                qty_from=None,
                qty_to=item_to.headline_qty,
                qty_delta=item_to.headline_qty,
                net_qty_from=None,
                net_qty_to=item_to.net_qty,
                net_qty_delta=item_to.net_qty,
                unit_from=None,
                unit_to=item_to.headline_unit,
                unit_delta=item_to.headline_unit,
                unit_delta_pct=None,
                amount_from=None,
                amount_to=item_to.amount,
                amount_delta=item_to.amount,
                notes=[f"New subscription added in {period_to_label}"],
                rows_from=[],
                rows_to=item_to.rows
            )
            changes.append(record)
            counts['NEW'] += 1

        elif in_from and not in_to:
            item_from = g_from[key]
            record = ChangeRecord(
                account=item_from.account,
                sku=item_from.sku,
                description=item_from.description,
                kind=item_from.kind,
                change_types=['REMOVED'],
                qty_from=item_from.headline_qty,
                qty_to=None,
                qty_delta=-item_from.headline_qty,
                net_qty_from=item_from.net_qty,
                net_qty_to=None,
                net_qty_delta=-item_from.net_qty,
                unit_from=item_from.headline_unit,
                unit_to=None,
                unit_delta=-item_from.headline_unit,
                unit_delta_pct=None,
                amount_from=item_from.amount,
                amount_to=None,
                amount_delta=-item_from.amount,
                notes=[f"Item dropped / not present in {period_to_label}"],
                rows_from=item_from.rows,
                rows_to=[]
            )
            changes.append(record)
            counts['REMOVED'] += 1

        else:
            item_from = g_from[key]
            item_to = g_to[key]
            change_types: List[str] = []
            notes: List[str] = []

            # Tier note differences (e.g. 40 domains -> 50 domains)
            if item_from.tier_note and item_to.tier_note and item_from.tier_note != item_to.tier_note:
                notes.append(f"Plan tier updated: {item_from.tier_note} -> {item_to.tier_note}")

            # Multiple underlying rows note (with headline vs net breakdown)
            if len(item_from.rows) > 1 or len(item_to.rows) > 1:
                notes.append(f"Net quantity after proration adjustments: {item_from.net_qty} -> {item_to.net_qty} (headline: {item_from.headline_qty} -> {item_to.headline_qty})")

            amt_delta = item_to.amount - item_from.amount
            qty_delta = item_to.headline_qty - item_from.headline_qty
            net_qty_delta = item_to.net_qty - item_from.net_qty
            unit_delta = item_to.headline_unit - item_from.headline_unit

            unit_delta_pct: Optional[Decimal] = None
            if item_from.headline_unit != Decimal('0'):
                unit_delta_pct = ((unit_delta / item_from.headline_unit) * Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            if item_from.kind == 'usage':
                # Metered usage diff
                if abs(amt_delta) > Decimal('0.005'):
                    change_types.append('USAGE_CHANGED')
                    counts['USAGE_CHANGED'] += 1
            else:
                # Price change: difference > 0.0001
                if abs(unit_delta) > Decimal('0.0001'):
                    change_types.append('PRICE_CHANGED')
                    counts['PRICE_CHANGED'] += 1

                # Quantity change: net quantity differs
                if net_qty_delta != Decimal('0'):
                    change_types.append('QUANTITY_CHANGED')
                    counts['QUANTITY_CHANGED'] += 1

            if change_types:
                record = ChangeRecord(
                    account=item_to.account,
                    sku=item_to.sku or item_from.sku,
                    description=item_to.description,
                    kind=item_to.kind,
                    change_types=change_types,
                    qty_from=item_from.headline_qty,
                    qty_to=item_to.headline_qty,
                    qty_delta=qty_delta,
                    net_qty_from=item_from.net_qty,
                    net_qty_to=item_to.net_qty,
                    net_qty_delta=net_qty_delta,
                    unit_from=item_from.headline_unit,
                    unit_to=item_to.headline_unit,
                    unit_delta=unit_delta,
                    unit_delta_pct=unit_delta_pct,
                    amount_from=item_from.amount,
                    amount_to=item_to.amount,
                    amount_delta=amt_delta,
                    notes=notes,
                    rows_from=item_from.rows,
                    rows_to=item_to.rows
                )
                changes.append(record)
            else:
                unchanged_count += 1
                counts['UNCHANGED'] += 1

    # Reconcile sum of deltas against net difference
    sum_deltas = sum((c.amount_delta for c in changes), Decimal('0'))
    reconciliation_diff = abs(sum_deltas - net_delta)
    reconciled = reconciliation_diff < Decimal('0.005')

    return ComparisonSummary(
        vendor_id=vendor_id,
        period_from=period_from_label,
        period_to=period_to_label,
        invoice_from_id=invoice_from_id,
        invoice_to_id=invoice_to_id,
        total_from=total_from,
        total_to=total_to,
        net_delta=net_delta,
        counts_by_type=counts,
        reconciled=reconciled,
        reconciliation_difference=reconciliation_diff,
        changes=changes,
        unchanged_count=unchanged_count
    )