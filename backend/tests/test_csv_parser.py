import os
from decimal import Decimal
import pytest
from app.parsers.base import ParseError
from app.parsers.csv_parser import SherwebCSVParser
from app.parsers.registry import default_registry

def get_sample_path(filename: str) -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, 'samples', filename)

def test_sherweb_july_csv_parsing():
    path = get_sample_path('vendor-sherweb-2026-07.csv')
    with open(path, 'rb') as f:
        content = f.read()

    parser = SherwebCSVParser()
    assert parser.can_parse('vendor-sherweb-2026-07.csv', content) >= 0.9

    result = parser.parse(content, filename='vendor-sherweb-2026-07.csv')
    assert result.vendor_guess == "Sherweb"
    assert result.invoice_meta.invoice_number == "VND-2026-07-0001"
    assert result.invoice_meta.invoice_date == "2026-07-20"
    assert result.invoice_meta.period_from == "2026-06-21"
    assert result.invoice_meta.period_to == "2026-07-21"
    assert result.invoice_meta.period_label == "2026-07"
    assert result.invoice_meta.currency == "USD"

    assert len(result.line_items) == 245
    accounts = set(item.account for item in result.line_items)
    assert len(accounts) == 33

    info_items = [item for item in result.line_items if item.kind == 'info']
    credit_items = [item for item in result.line_items if item.kind == 'credit']
    neg_qty_items = [item for item in result.line_items if item.quantity < Decimal('0')]
    usage_items = [item for item in result.line_items if item.kind == 'usage']
    charge_items = [item for item in result.line_items if item.kind == 'charge']

    assert len(info_items) == 9
    assert len(neg_qty_items) == 37
    assert len(credit_items) == 39
    assert len(usage_items) == 9
    assert len(charge_items) == 188
    assert len(info_items) + len(credit_items) + len(usage_items) + len(charge_items) == 245

    blank_list_prices = [item for item in result.line_items if item.list_price is None]
    assert len(blank_list_prices) == 11

    assert result.computed_total == Decimal('20362.51')

    for item in result.line_items:
        assert isinstance(item.quantity, Decimal)
        assert isinstance(item.unit_cost, Decimal)
        assert isinstance(item.line_total, Decimal)
        if item.list_price is not None:
            assert isinstance(item.list_price, Decimal)

def test_sherweb_august_csv_parsing():
    path = get_sample_path('vendor-sherweb-2026-08.csv')
    with open(path, 'rb') as f:
        content = f.read()

    parser = SherwebCSVParser()
    assert parser.can_parse('vendor-sherweb-2026-08.csv', content) >= 0.9

    result = parser.parse(content, filename='vendor-sherweb-2026-08.csv')
    assert result.vendor_guess == "Sherweb"
    assert result.invoice_meta.invoice_number == "VND-2026-08-0001"
    assert result.invoice_meta.invoice_date == "2026-08-20"
    assert result.invoice_meta.period_from == "2026-07-21"
    assert result.invoice_meta.period_to == "2026-08-21"
    assert result.invoice_meta.period_label == "2026-08"

    assert len(result.line_items) == 245
    accounts = set(item.account for item in result.line_items)
    assert len(accounts) == 33

    info_items = [item for item in result.line_items if item.kind == 'info']
    credit_items = [item for item in result.line_items if item.kind == 'credit']
    neg_qty_items = [item for item in result.line_items if item.quantity < Decimal('0')]
    usage_items = [item for item in result.line_items if item.kind == 'usage']
    charge_items = [item for item in result.line_items if item.kind == 'charge']
    
    assert len(info_items) == 9
    assert len(neg_qty_items) == 37
    assert len(credit_items) == 39
    assert len(usage_items) == 9
    assert len(charge_items) == 188
    assert len(info_items) + len(credit_items) + len(usage_items) + len(charge_items) == 245

    assert result.computed_total == Decimal('20982.97')

def test_sherweb_row_kind_counts_and_rules():
    """Verify exact kind classifications across both July and August Sherweb files."""
    parser = SherwebCSVParser()
    for fname in ['vendor-sherweb-2026-07.csv', 'vendor-sherweb-2026-08.csv']:
        path = get_sample_path(fname)
        with open(path, 'rb') as f:
            res = parser.parse(f.read(), filename=fname)
        
        counts = {
            'charge': len([i for i in res.line_items if i.kind == 'charge']),
            'credit': len([i for i in res.line_items if i.kind == 'credit']),
            'usage': len([i for i in res.line_items if i.kind == 'usage']),
            'info': len([i for i in res.line_items if i.kind == 'info']),
        }
        assert counts == {'charge': 188, 'credit': 39, 'usage': 9, 'info': 9}
        # SWAZPLU02 and SWAZPLU03 must both be usage
        swaz_skus = set(i.sku for i in res.line_items if i.sku and i.sku.startswith('SWAZPLU'))
        assert swaz_skus == {'SWAZPLU02', 'SWAZPLU03'}
        for i in res.line_items:
            if i.sku and i.sku.startswith('SWAZPLU'):
                assert i.kind == 'usage'

def test_csv_parser_tolerances():
    bom_csv = b"\xeF\xbB\xBFInvoiceNo,InvoicingDate,InvoicePeriodFrom,InvoicePeriodTo,Organization,Description,SKU,Qty,ListPrice,UnitPrice,LineTotal,Currency\r\nINV-1,2026-01-15,2026-01-01,2026-01-31,Test Org,Test SKU Desc,SKU1,2,10.00,10.00,20.00,USD\r\n"
    parser = SherwebCSVParser()
    result = parser.parse(bom_csv, filename="test.csv")
    assert len(result.line_items) == 1
    assert result.line_items[0].account == "Test Org"
    assert result.line_items[0].line_total == Decimal('20.00')

def test_csv_header_alias_mapping():
    custom_csv = b"Customer,Item,Part Number,Seats,Price,Total\nAcme Corp,Cloud Widget,WIDG-01,5,15.50,77.50\n"
    parser = SherwebCSVParser()
    result = parser.parse(custom_csv, filename="custom.csv")
    assert len(result.line_items) == 1
    assert result.line_items[0].account == "Acme Corp"
    assert result.line_items[0].quantity == Decimal('5')
    assert result.line_items[0].unit_cost == Decimal('15.50')
    assert result.line_items[0].line_total == Decimal('77.50')

def test_csv_parser_errors():
    parser = SherwebCSVParser()
    with pytest.raises(ParseError):
        parser.parse(b"", filename="empty.csv")

    with pytest.raises(ParseError):
        parser.parse(b"Foo,Bar,Baz\n1,2,3\n", filename="invalid.csv")

def test_csv_parser_can_parse_edge_cases():
    parser = SherwebCSVParser()
    assert parser.can_parse("test.txt", b"") == 0.0
    assert parser.can_parse("data.csv", b"random content without keywords") == 0.3
    assert parser.can_parse("data.csv", b"organization,unitprice\nacme,10") == 0.8
    assert parser.can_parse("data.csv", b"invoiceno,organization,linetotal\n1,acme,10") == 0.95

def test_csv_parser_invalid_numeric_row_warning():
    csv_data = b"Organization,Description,Qty,UnitPrice,LineTotal\nAlpha Corp,Valid Item,2,10.00,20.00\nBeta Corp,Mismatched Row,2,10.00,50.00\n"
    parser = SherwebCSVParser()
    res = parser.parse(csv_data, filename="warnings.csv")
    assert len(res.line_items) == 2
    assert len(res.warnings) >= 1

def test_csv_parser_decoding_and_blank_rows():
    parser = SherwebCSVParser()
    # Test _parse_decimal directly
    assert parser._parse_decimal(None) is None
    assert parser._parse_decimal("invalid", Decimal('0')) == Decimal('0')

    # Test latin-1 encoded CSV with blank lines
    latin1_csv = "Organization,Description,Qty,UnitPrice,LineTotal\n\nAcme Corp,Français Service,1,10.00,10.00\n\n".encode("latin-1")
    res = parser.parse(latin1_csv, filename="latin1.csv")
    assert len(res.line_items) == 1
    assert res.line_items[0].description == "Français Service"

    # Test headerless CSV raises ParseError
    with pytest.raises(ParseError):
        parser.parse(b"\n\n\n", filename="empty_lines.csv")
