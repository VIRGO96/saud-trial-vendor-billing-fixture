import csv
import io
from decimal import Decimal
from typing import List, Optional
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.services.comparison import ChangeRecord, ComparisonSummary

def export_changes_to_csv(summary: ComparisonSummary, vendor_name: str = "Vendor") -> bytes:
    """
    Generate CSV export of invoice changes (UTF-8 with BOM for Excel compatibility).
    """
    out = io.StringIO()
    # Write BOM
    out.write('\ufeff')
    writer = csv.writer(out)

    headers = [
        'vendor',
        'period_from',
        'period_to',
        'change_type',
        'account',
        'sku',
        'description',
        'qty_from',
        'qty_to',
        'qty_delta',
        'unit_from',
        'unit_to',
        'unit_delta',
        'unit_delta_pct',
        'amount_from',
        'amount_to',
        'amount_delta',
        'notes'
    ]
    writer.writerow(headers)

    for c in summary.changes:
        chg_type_str = "/".join(c.change_types)
        pct_str = f"{c.unit_delta_pct:.2f}%" if c.unit_delta_pct is not None else ""
        notes_str = "; ".join(c.notes)
        writer.writerow([
            vendor_name,
            summary.period_from,
            summary.period_to,
            chg_type_str,
            c.account,
            c.sku or '',
            c.description,
            str(c.qty_from) if c.qty_from is not None else "",
            str(c.qty_to) if c.qty_to is not None else "",
            str(c.qty_delta),
            f"{c.unit_from:.4f}" if c.unit_from is not None else "",
            f"{c.unit_to:.4f}" if c.unit_to is not None else "",
            f"{c.unit_delta:.4f}",
            pct_str,
            f"{c.amount_from:.2f}" if c.amount_from is not None else "",
            f"{c.amount_to:.2f}" if c.amount_to is not None else "",
            f"{c.amount_delta:.2f}",
            notes_str
        ])

    return out.getvalue().encode('utf-8')

def export_changes_to_xlsx(summary: ComparisonSummary, vendor_name: str = "Vendor") -> bytes:
    """
    Generate multi-tab Excel workbook (Summary + Changes) with formatting and currency styles.
    """
    wb = openpyxl.Workbook()
    # Default sheet: Summary
    ws_summary = wb.active
    ws_summary.title = "Summary"

    # Styling constants
    header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    title_font = Font(name="Arial", size=14, bold=True, color="0F172A")
    bold_font = Font(name="Arial", size=10, bold=True)
    regular_font = Font(name="Arial", size=10)
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Change type color fills
    fill_new = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid") # Blue
    fill_removed = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid") # Light Red
    fill_price = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid") # Amber
    fill_qty = PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid") # Indigo

    # 1. Summary Sheet
    ws_summary.views.sheetView[0].showGridLines = True
    ws_summary['A1'] = f"{vendor_name} Billing Reconciliation Summary"
    ws_summary['A1'].font = title_font

    ws_summary['A3'] = "Comparison Period:"
    ws_summary['B3'] = f"{summary.period_from} -> {summary.period_to}"
    ws_summary['A3'].font = bold_font
    ws_summary['B3'].font = regular_font

    ws_summary['A4'] = f"Total ({summary.period_from}):"
    ws_summary['B4'] = summary.total_from
    ws_summary['B4'].number_format = "$#,##0.00"
    ws_summary['A4'].font = bold_font

    ws_summary['A5'] = f"Total ({summary.period_to}):"
    ws_summary['B5'] = summary.total_to
    ws_summary['B5'].number_format = "$#,##0.00"
    ws_summary['A5'].font = bold_font

    ws_summary['A6'] = "Net Delta:"
    ws_summary['B6'] = summary.net_delta
    ws_summary['B6'].number_format = "$#,##0.00"
    ws_summary['A6'].font = bold_font

    ws_summary['A7'] = "Reconciliation Status:"
    ws_summary['B7'] = "Reconciled to the cent" if summary.reconciled else f"Discrepancy: ${summary.reconciliation_difference}"
    ws_summary['A7'].font = bold_font
    ws_summary['B7'].font = Font(name="Arial", size=10, bold=True, color="16A34A" if summary.reconciled else "DC2626")

    # Counts table on summary sheet
    ws_summary['A10'] = "Change Type"
    ws_summary['B10'] = "Count"
    ws_summary['A10'].font = header_font
    ws_summary['B10'].font = header_font
    ws_summary['A10'].fill = header_fill
    ws_summary['B10'].fill = header_fill

    type_labels = [
        ("NEW", "New Subscriptions Added"),
        ("REMOVED", "Subscriptions Removed"),
        ("PRICE_CHANGED", "Price / Rate Increases"),
        ("QUANTITY_CHANGED", "License / Seat Count Changes"),
        ("USAGE_CHANGED", "Usage Tier Shifts"),
        ("UNCHANGED", "Unchanged Subscriptions"),
    ]

    for idx, (ctype, label) in enumerate(type_labels, start=11):
        ws_summary[f'A{idx}'] = label
        ws_summary[f'B{idx}'] = summary.counts_by_type.get(ctype, 0)
        ws_summary[f'A{idx}'].font = regular_font
        ws_summary[f'B{idx}'].font = regular_font
        ws_summary[f'A{idx}'].border = thin_border
        ws_summary[f'B{idx}'].border = thin_border

    # Auto-fit summary columns
    for col in ws_summary.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_summary.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # -------------------------------------------------------------
    # Sheet 2: Changes
    # -------------------------------------------------------------
    ws_changes = wb.create_sheet(title="Changes")
    ws_changes.views.sheetView[0].showGridLines = True

    headers = [
        'Vendor',
        'Period From',
        'Period To',
        'Change Type',
        'Account',
        'SKU',
        'Description',
        'Qty From',
        'Qty To',
        'Qty Delta',
        'Unit From',
        'Unit To',
        'Unit Delta',
        'Unit Delta %',
        'Amount From',
        'Amount To',
        'Amount Delta',
        'Notes'
    ]

    for col_idx, h in enumerate(headers, start=1):
        cell = ws_changes.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center" if "Qty" in h or "Period" in h else "left")

    for r_idx, c in enumerate(summary.changes, start=2):
        chg_type_str = "/".join(c.change_types)
        pct_val = (c.unit_delta_pct / Decimal('100')) if c.unit_delta_pct is not None else ""

        row_data = [
            vendor_name,
            summary.period_from,
            summary.period_to,
            chg_type_str,
            c.account,
            c.sku or '',
            c.description,
            c.qty_from if c.qty_from is not None else "",
            c.qty_to if c.qty_to is not None else "",
            c.qty_delta,
            c.unit_from if c.unit_from is not None else "",
            c.unit_to if c.unit_to is not None else "",
            c.unit_delta,
            pct_val,
            c.amount_from if c.amount_from is not None else "",
            c.amount_to if c.amount_to is not None else "",
            c.amount_delta,
            "; ".join(c.notes)
        ]

        for col_idx, val in enumerate(row_data, start=1):
            cell = ws_changes.cell(row=r_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border

            # Formats
            if col_idx in (8, 9, 10): # Qty
                cell.number_format = "#,##0.####"
                cell.alignment = Alignment(horizontal="right")
            elif col_idx in (11, 12, 13): # Unit Cost
                cell.number_format = "$#,##0.0000"
                cell.alignment = Alignment(horizontal="right")
            elif col_idx == 14: # Pct
                cell.number_format = "0.00%"
                cell.alignment = Alignment(horizontal="right")
            elif col_idx in (15, 16, 17): # Amounts
                cell.number_format = "$#,##0.00"
                cell.alignment = Alignment(horizontal="right")

            # Change Type Highlight
            if col_idx == 4:
                if 'NEW' in c.change_types:
                    cell.fill = fill_new
                elif 'REMOVED' in c.change_types:
                    cell.fill = fill_removed
                elif 'PRICE_CHANGED' in c.change_types:
                    cell.fill = fill_price
                elif 'QUANTITY_CHANGED' in c.change_types:
                    cell.fill = fill_qty

    # Auto-fit columns and enable autofilter
    ws_changes.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(summary.changes) + 1}"
    ws_changes.freeze_panes = "A2"

    for col in ws_changes.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_changes.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()