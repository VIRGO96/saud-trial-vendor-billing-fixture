import csv
import io
import re
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple
from app.parsers.base import BaseParser, InvoiceMeta, ParsedLineItem, ParseError, ParseResult, ParseWarning

HEADER_ALIASES = {
    'account': ['organization', 'customer', 'account', 'client', 'company'],
    'sku': ['sku', 'part number', 'item code', 'product code', 'item_code', 'part_number'],
    'description': ['description', 'item', 'product', 'item description', 'details'],
    'quantity': ['qty', 'quantity', 'units', 'seats', 'count'],
    'list_price': ['listprice', 'list price', 'msrp'],
    'unit_cost': ['unitprice', 'unit price', 'rate', 'price', 'unit_cost', 'cost'],
    'line_total': ['linetotal', 'line total', 'total', 'amount', 'ext price', 'subtotal'],
    'invoice_number': ['invoiceno', 'invoice no', 'invoice number', 'invoice #', 'invoicenumber'],
    'invoice_date': ['invoicingdate', 'invoicing date', 'invoice date', 'date'],
    'period_from': ['invoiceperiodfrom', 'invoice period from', 'period from', 'start date', 'period_from'],
    'period_to': ['invoiceperiodto', 'invoice period to', 'period to', 'end date', 'period_to'],
    'currency': ['currency', 'curr']
}

def normalize_header(h: str) -> str:
    return re.sub(r'[^a-z0-9]', '', h.lower().strip())

def clean_desc_match_key(desc: str) -> str:
    cleaned = desc.lower().strip()
    cleaned = re.sub(r'[‐-―−]', '-', cleaned) # Normalize unicode dashes
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned

class SherwebCSVParser(BaseParser):
    name = "SherwebCSVParser"
    version = "1.0"

    def can_parse(self, filename: str, content: bytes) -> float:
        if not content:
            return 0.0
        # Check text decoding
        try:
            sample = content[:4096].decode('utf-8-sig', errors='ignore').lower()
        except Exception:
            return 0.0

        if 'invoiceno' in sample and 'organization' in sample and 'linetotal' in sample:
            return 0.95
        if 'organization' in sample and ('unitprice' in sample or 'qty' in sample):
            return 0.8
        if filename.lower().endswith('.csv'):
            return 0.3
        return 0.0

    def _map_headers(self, raw_headers: List[str]) -> Tuple[Dict[str, int], List[str]]:
        mapping = {}
        missing_required = []
        normalized_headers = [normalize_header(h) for h in raw_headers]

        for canonical, aliases in HEADER_ALIASES.items():
            found = False
            for alias in aliases:
                norm_alias = normalize_header(alias)
                if norm_alias in normalized_headers:
                    mapping[canonical] = normalized_headers.index(norm_alias)
                    found = True
                    break
            if not found and canonical in ['account', 'description', 'line_total']:
                missing_required.append(canonical)

        return mapping, missing_required

    def _parse_decimal(self, val: str, default: Optional[Decimal] = None) -> Optional[Decimal]:
        if val is None:
            return default
        s = str(val).strip().replace(',', '').replace('$', '')
        if not s:
            return default
        try:
            return Decimal(s)
        except InvalidOperation:
            return default

    def parse(self, content: bytes, filename: str = "") -> ParseResult:
        if not content:
            raise ParseError("File content is empty.")

        try:
            text = content.decode('utf-8-sig')
        except UnicodeDecodeError:
            try:
                text = content.decode('latin-1')
            except Exception as e:
                raise ParseError(f"Unable to decode CSV text: {e}")

        reader = csv.reader(io.StringIO(text))
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise ParseError("CSV file has no content/headers.")

        header_map, missing = self._map_headers(raw_headers)
        if missing:
            raise ParseError(f"CSV missing mandatory columns: {', '.join(missing)}")

        line_items: List[ParsedLineItem] = []
        warnings: List[ParseWarning] = []

        invoice_number = None
        invoice_date = None
        period_from = None
        period_to = None
        currency = "USD"

        def get_val(row: List[str], key: str) -> str:
            if key in header_map and header_map[key] < len(row):
                return row[header_map[key]].strip()
            return ""

        row_index = 0
        for raw_row in reader:
            if not raw_row or not any(field.strip() for field in raw_row):
                continue # Skip empty lines
            row_index += 1

            if not invoice_number and get_val(raw_row, 'invoice_number'):
                invoice_number = get_val(raw_row, 'invoice_number')
            if not invoice_date and get_val(raw_row, 'invoice_date'):
                invoice_date = get_val(raw_row, 'invoice_date')
            if not period_from and get_val(raw_row, 'period_from'):
                period_from = get_val(raw_row, 'period_from')
            if not period_to and get_val(raw_row, 'period_to'):
                period_to = get_val(raw_row, 'period_to')
            if get_val(raw_row, 'currency'):
                currency = get_val(raw_row, 'currency')

            account = get_val(raw_row, 'account')
            sku = get_val(raw_row, 'sku') or None
            description = get_val(raw_row, 'description')
            qty_str = get_val(raw_row, 'quantity')
            list_price_str = get_val(raw_row, 'list_price')
            unit_cost_str = get_val(raw_row, 'unit_cost')
            line_total_str = get_val(raw_row, 'line_total')

            # Build raw_data dictionary mapping header names
            raw_dict = {raw_headers[i]: (raw_row[i] if i < len(raw_row) else "") for i in range(len(raw_headers))}

            # Classification rules:
            # 1. Blank Qty and blank UnitPrice -> 'info' (e.g. provisioning text)
            # 2. SKU SWAZPLU02 -> metered 'usage'
            # 3. Negative Qty or negative line_total -> 'credit'
            # 4. Otherwise -> 'charge'
            if not qty_str and not unit_cost_str:
                kind = "info"
                quantity = Decimal('0')
                unit_cost = Decimal('0')
                line_total = self._parse_decimal(line_total_str, Decimal('0')) or Decimal('0')
                list_price = self._parse_decimal(list_price_str, None)
            else:
                quantity = self._parse_decimal(qty_str, Decimal('0')) or Decimal('0')
                unit_cost = self._parse_decimal(unit_cost_str, Decimal('0')) or Decimal('0')
                line_total = self._parse_decimal(line_total_str, Decimal('0')) or Decimal('0')
                list_price = self._parse_decimal(list_price_str, None)

                if sku and sku.upper().startswith('SWAZPLU'):
                    kind = "usage"
                elif quantity < Decimal('0') or line_total < Decimal('0'):
                    kind = "credit"
                else:
                    kind = "charge"

            # Per-row calculation check (warn if gross mismatch, accounting for proration rounding)
            if kind in ('charge', 'credit') and quantity != Decimal('0') and unit_cost != Decimal('0'):
                expected_total = quantity * unit_cost
                if abs(expected_total - line_total) > Decimal('0.05'):
                    warnings.append(ParseWarning(
                        row_index=row_index,
                        message=f"Row {row_index}: calculated {quantity} x {unit_cost} = {expected_total:.2f} differs from line total {line_total}"
                    ))

            match_key = sku.upper().strip() if sku else clean_desc_match_key(description)

            line_items.append(ParsedLineItem(
                row_index=row_index,
                account=account,
                sku=sku,
                description=description,
                match_key=match_key,
                quantity=quantity,
                list_price=list_price,
                unit_cost=unit_cost,
                line_total=line_total,
                kind=kind,
                raw_data=raw_dict
            ))

        if not line_items:
            raise ParseError("No line items found in CSV.")

        # Determine period_label (default to invoice_date YYYY-MM or period_to / filename)
        period_label = "unknown"
        if invoice_date and len(invoice_date) >= 7:
            period_label = invoice_date[:7]
        elif period_from and len(period_from) >= 7:
            period_label = period_from[:7]
        elif filename:
            m = re.search(r'(\d{4}[-_]\d{2})', filename)
            if m:
                period_label = m.group(1).replace('_', '-')

        invoice_meta = InvoiceMeta(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            period_from=period_from,
            period_to=period_to,
            period_label=period_label,
            currency=currency,
            declared_total=None,
            source_format="csv"
        )

        vendor_guess = "Sherweb"
        if "sherweb" not in filename.lower() and "sherweb" not in text[:500].lower():
            # generic vendor guess if needed
            vendor_guess = "Generic Vendor"

        return ParseResult(
            parser_name=self.name,
            parser_version=self.version,
            vendor_guess=vendor_guess,
            invoice_meta=invoice_meta,
            line_items=line_items,
            warnings=warnings
        )
