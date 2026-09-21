import os
from decimal import Decimal
import pytest
from app.parsers.base import ParseError
from app.parsers.pdf_parser import PowerDMARCPDFParser, normalize_match_key
from app.parsers.registry import default_registry
from app.services.comparison import compare_invoices

def get_sample_path(filename: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'samples', filename)

def get_fixture_path(filename: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'fixtures', 'generated', filename)

def test_powerdmarc_real_pdf_parsing():
    path = get_sample_path('vendor-powerdmarc-2026-08.pdf')
    with open(path, 'rb') as f:
        content = f.read()

    parser = PowerDMARCPDFParser()
    assert parser.can_parse('vendor-powerdmarc-2026-08.pdf', content) >= 0.9

    result = parser.parse(content, filename='vendor-powerdmarc-2026-08.pdf')
    assert result.vendor_guess == "PowerDMARC"
    assert result.invoice_meta.invoice_number == "INV-000000"
    assert result.invoice_meta.invoice_date == "2026-08-13"
    assert result.invoice_meta.period_from == "2026-08-13"
    assert result.invoice_meta.period_to == "2026-09-12"
    assert result.invoice_meta.period_label == "2026-08"
    assert result.invoice_meta.currency == "USD"
    assert result.invoice_meta.declared_total == Decimal('1297.00')
    assert result.computed_total == Decimal('1297.00')
    assert len(result.warnings) == 0

    assert len(result.line_items) == 1
    item = result.line_items[0]
    assert item.account == "Example MSP LLC"
    assert item.sku is None
    assert "PowerDMARC MSP Partner Plan" in item.description
    assert item.quantity == Decimal('1')
    assert item.unit_cost == Decimal('1297.00')
    assert item.line_total == Decimal('1297.00')
    assert item.kind == "charge"
    assert item.match_key == "powerdmarc msp partner plan - monthly"
    assert item.raw_data.get('tier_note') == "40 domains included"

def test_powerdmarc_synthetic_pdf_comparison():
    path_aug = get_sample_path('vendor-powerdmarc-2026-08.pdf')
    path_sep = get_fixture_path('powerdmarc-2026-09-SYNTHETIC.pdf')

    if not os.path.exists(path_sep):
        pytest.skip("Synthetic fixture not generated yet")

    parser = PowerDMARCPDFParser()
    with open(path_aug, 'rb') as f:
        res_aug = parser.parse(f.read(), 'vendor-powerdmarc-2026-08.pdf')
    with open(path_sep, 'rb') as f:
        res_sep = parser.parse(f.read(), 'powerdmarc-2026-09-SYNTHETIC.pdf')

    assert res_aug.computed_total == Decimal('1297.00')
    assert res_sep.computed_total == Decimal('1445.00')
    assert len(res_sep.line_items) == 2

    comp = compare_invoices(res_aug.line_items, res_sep.line_items, "2026-08", "2026-09")
    assert len(comp.changes) == 2
    assert comp.reconciled is True
    assert comp.net_delta == Decimal('148.00')

    # Price change item
    price_chg = next(c for c in comp.changes if 'PRICE_CHANGED' in c.change_types)
    assert price_chg.unit_from == Decimal('1297.00')
    assert price_chg.unit_to == Decimal('1347.00')
    assert price_chg.amount_delta == Decimal('50.00')
    assert any("40 domains included -> 50 domains included" in note for note in price_chg.notes)

    # New add-on item
    new_item = next(c for c in comp.changes if 'NEW' in c.change_types)
    assert "Additional Domains" in new_item.description
    assert new_item.qty_to == Decimal('2')
    assert new_item.unit_to == Decimal('49.00')
    assert new_item.amount_delta == Decimal('98.00')

def test_pdf_match_key_normalization():
    k1 = normalize_match_key("PowerDMARC MSP Partner Plan — Monthly 13 Aug 2026")
    k2 = normalize_match_key("1 PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026")
    k3 = normalize_match_key("PowerDMARC MSP Partner Plan - Monthly September 2026")
    assert k1 == "powerdmarc msp partner plan - monthly"
    assert k2 == "powerdmarc msp partner plan - monthly"
    assert k3 == "powerdmarc msp partner plan - monthly"
    assert k1 == k2 == k3

def test_pdf_registry_dispatch():
    path = get_sample_path('vendor-powerdmarc-2026-08.pdf')
    with open(path, 'rb') as f:
        content = f.read()

    parser, conf = default_registry.get_best_parser('vendor-powerdmarc-2026-08.pdf', content)
    assert isinstance(parser, PowerDMARCPDFParser)
    assert conf >= 0.9

def test_pdf_parser_errors():
    parser = PowerDMARCPDFParser()
    with pytest.raises(ParseError):
        parser.parse(b"", filename="empty.pdf")

    with pytest.raises(ParseError):
        parser.parse(b"%PDF-1.4\ncorrupt content without text", filename="corrupt.pdf")

def test_pdf_parser_decimal_parsing_helpers():
    parser = PowerDMARCPDFParser()
    assert parser._parse_decimal("$1,297.50") == Decimal("1297.50")
    assert parser._parse_decimal("(50.00)") == Decimal("-50.00")
    assert parser._parse_decimal(None) is None
    assert parser._parse_decimal("invalid-val") is None

def test_parse_pdf_date_formats():
    from app.parsers.pdf_parser import parse_pdf_date
    assert parse_pdf_date("13 Aug 2026") == "2026-08-13"
    assert parse_pdf_date("2026-08-20") == "2026-08-20"
    assert parse_pdf_date("August 20, 2026") == "2026-08-20"
    assert parse_pdf_date("") is None
    assert parse_pdf_date("not a date") is None

def test_pdf_parser_can_parse_branches():
    parser = PowerDMARCPDFParser()
    assert parser.can_parse("sample.txt", b"") == 0.0
    assert parser.can_parse("sample.pdf", b"too_short") == 0.0
    assert parser.can_parse("sample.pdf", b"not_a_pdf_header_long_string") == 0.0

def test_pdf_hash_column_never_in_description_or_match_key():
    path = get_sample_path('vendor-powerdmarc-2026-08.pdf')
    with open(path, 'rb') as f:
        res = PowerDMARCPDFParser().parse(f.read(), 'vendor-powerdmarc-2026-08.pdf')
    for item in res.line_items:
        assert not item.description.startswith('#')
        assert not item.description.startswith('1')
        assert not item.match_key.startswith('#')
        assert not item.match_key.startswith('1')
        assert '#' not in item.match_key

def test_pdf_extra_item_inserted_above_plan_and_reordering():
    from app.parsers.base import ParsedLineItem
    # Invoice From (Aug): Only Plan
    item_aug_plan = ParsedLineItem(
        row_index=1,
        account="Example MSP LLC",
        sku=None,
        description="PowerDMARC MSP Partner Plan — Monthly 13 Aug 2026 – 12 Sep 2026 · 40 domains included",
        match_key=normalize_match_key("PowerDMARC MSP Partner Plan — Monthly 13 Aug 2026 – 12 Sep 2026 · 40 domains included"),
        quantity=Decimal('1'),
        list_price=None,
        unit_cost=Decimal('1297.00'),
        line_total=Decimal('1297.00'),
        kind="charge",
        raw_data={'row_index': 1, 'tier_note': '40 domains included'}
    )

    # Invoice To Variant 1: Extra item inserted ABOVE plan line (row 1: Dedicated IP, row 2: Plan)
    item_sep_ip = ParsedLineItem(
        row_index=1,
        account="Example MSP LLC",
        sku=None,
        description="PowerDMARC Dedicated IP Add-on 13 Sep 2026 – 12 Oct 2026",
        match_key=normalize_match_key("PowerDMARC Dedicated IP Add-on 13 Sep 2026 – 12 Oct 2026"),
        quantity=Decimal('1'),
        list_price=None,
        unit_cost=Decimal('50.00'),
        line_total=Decimal('50.00'),
        kind="charge",
        raw_data={'row_index': 1}
    )
    item_sep_plan = ParsedLineItem(
        row_index=2,
        account="Example MSP LLC",
        sku=None,
        description="PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included",
        match_key=normalize_match_key("PowerDMARC MSP Partner Plan — Monthly 13 Sep 2026 – 12 Oct 2026 · 50 domains included"),
        quantity=Decimal('1'),
        list_price=None,
        unit_cost=Decimal('1347.00'),
        line_total=Decimal('1347.00'),
        kind="charge",
        raw_data={'row_index': 2, 'tier_note': '50 domains included'}
    )

    # Invoice To Variant 2: Reordered (row 1: Plan, row 2: Dedicated IP)
    items_to_above = [item_sep_ip, item_sep_plan]
    items_to_reordered = [item_sep_plan, item_sep_ip]

    comp_above = compare_invoices([item_aug_plan], items_to_above, "2026-08", "2026-09")
    comp_reordered = compare_invoices([item_aug_plan], items_to_reordered, "2026-08", "2026-09")

    # Both comparisons must produce identical diffs without false removed+new
    for comp in (comp_above, comp_reordered):
        assert comp.reconciled is True
        assert comp.net_delta == Decimal('100.00')  # +50 price hike + +50 new item
        assert comp.counts_by_type['PRICE_CHANGED'] == 1
        assert comp.counts_by_type['NEW'] == 1
        assert comp.counts_by_type['REMOVED'] == 0
        assert comp.counts_by_type['QUANTITY_CHANGED'] == 0
        assert comp.counts_by_type['UNCHANGED'] == 0

        p_chg = next(c for c in comp.changes if 'PRICE_CHANGED' in c.change_types)
        assert p_chg.unit_from == Decimal('1297.00')
        assert p_chg.unit_to == Decimal('1347.00')
        assert p_chg.amount_delta == Decimal('50.00')

        new_chg = next(c for c in comp.changes if 'NEW' in c.change_types)
        assert new_chg.amount_delta == Decimal('50.00')

def test_pdf_parser_extended_branches(monkeypatch):
    from unittest.mock import MagicMock
    from app.parsers.pdf_parser import extract_tier_note

    # 1. extract_tier_note returns None when no match
    assert extract_tier_note("No domains info here") is None

    parser = PowerDMARCPDFParser()

    # 2. can_parse branches
    # Empty pages
    mock_pdf_empty = MagicMock()
    mock_pdf_empty.pages = []
    mock_pdf_empty.__enter__.return_value = mock_pdf_empty
    monkeypatch.setattr("pdfplumber.open", lambda *a, **kw: mock_pdf_empty)
    assert parser.can_parse("dummy.pdf", b"%PDF-1.4 header") == 0.0

    # Page with item & description and sub total
    mock_page_generic = MagicMock()
    mock_page_generic.extract_text.return_value = "item & description ... sub total ..."
    mock_pdf_generic = MagicMock()
    mock_pdf_generic.pages = [mock_page_generic]
    mock_pdf_generic.__enter__.return_value = mock_pdf_generic
    monkeypatch.setattr("pdfplumber.open", lambda *a, **kw: mock_pdf_generic)
    assert parser.can_parse("generic.pdf", b"%PDF-1.4 header") == 0.85

    # Page with generic text
    mock_page_plain = MagicMock()
    mock_page_plain.extract_text.return_value = "plain document text"
    mock_pdf_plain = MagicMock()
    mock_pdf_plain.pages = [mock_page_plain]
    mock_pdf_plain.__enter__.return_value = mock_pdf_plain
    monkeypatch.setattr("pdfplumber.open", lambda *a, **kw: mock_pdf_plain)
    assert parser.can_parse("plain.pdf", b"%PDF-1.4 header") == 0.4

    # 3. parse() when PDF has no pages
    mock_pdf_no_pages = MagicMock()
    mock_pdf_no_pages.pages = []
    mock_pdf_no_pages.__enter__.return_value = mock_pdf_no_pages
    monkeypatch.setattr("pdfplumber.open", lambda *a, **kw: mock_pdf_no_pages)
    with pytest.raises(ParseError, match="PDF has no pages"):
        parser.parse(b"%PDF-1.4 header", "nopages.pdf")

    # 4. parse() with table lacking hash column (#) but having amount column, Bill To, and declared total discrepancy
    mock_page_table = MagicMock()
    mock_page_table.height = 800
    mock_page_table.extract_text.return_value = """
    Bill To
    Acme Health Corp
    Invoice# INV-9999
    Total $500.00
    """
    mock_page_table.extract_words.return_value = [
        {'text': 'Item', 'top': 100, 'x0': 70, 'x1': 100},
        {'text': 'Qty', 'top': 100, 'x0': 350, 'x1': 370},
        {'text': 'Rate', 'top': 100, 'x0': 420, 'x1': 440},
        {'text': 'Amount', 'top': 100, 'x0': 500, 'x1': 530},
        # Line item without hash words (all x0 >= 70)
        {'text': 'Standard Security Service 15 Aug 2026 – 15 Sep 2026', 'top': 120, 'x0': 70, 'x1': 300},
        {'text': '2', 'top': 120, 'x0': 350, 'x1': 360},
        {'text': '100.00', 'top': 120, 'x0': 420, 'x1': 450},
        {'text': '200.00', 'top': 120, 'x0': 500, 'x1': 530},
        # Footer
        {'text': 'Total', 'top': 200, 'x0': 500, 'x1': 530},
    ]

    mock_pdf_table = MagicMock()
    mock_pdf_table.pages = [mock_page_table]
    mock_pdf_table.__enter__.return_value = mock_pdf_table
    monkeypatch.setattr("pdfplumber.open", lambda *a, **kw: mock_pdf_table)

    res = parser.parse(b"%PDF-1.4 header", "test_nohash.pdf")
    assert res.vendor_guess == "PDF Vendor"
    assert res.invoice_meta.invoice_number == "INV-9999"
    assert res.invoice_meta.period_label == "2026-08"
    assert res.invoice_meta.declared_total == Decimal("500.00")
    assert res.computed_total == Decimal("200.00")
    assert len(res.warnings) == 1
    assert "does not match declared invoice total" in res.warnings[0].message
    assert len(res.line_items) == 1
    assert res.line_items[0].account == "Acme Health Corp"
    assert res.line_items[0].quantity == Decimal("2")
    assert res.line_items[0].unit_cost == Decimal("100.00")
    assert res.line_items[0].line_total == Decimal("200.00")