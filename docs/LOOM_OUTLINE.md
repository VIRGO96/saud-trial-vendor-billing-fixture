# Video Walkthrough Outline (Loom Script)

**Target Duration**: 8 to 10 Minutes  
**Audience**: Client Evaluation Team, Engineering Leads, Financial Operations Stakeholders  
**Presenter Tone**: Professional, technical, authoritative, focused on correctness and domain accuracy.

---

## Timeline & Scene-by-Scene Breakdown

```
[00:00 - 01:15] Introduction & The Problem Space
[01:15 - 02:45] System Architecture & Decimal Precision Engineering
[02:45 - 04:30] Sherweb CSV Ingestion & Period-over-Period Reconciliation
[04:30 - 06:15] Expandable Line Item Drilldown & Proration Aggregation
[06:15 - 07:30] Multi-Format PDF Ingestion: PowerDMARC Real vs. Synthetic
[07:30 - 08:30] Multi-Sheet Excel & RFC-4180 CSV Export Pipeline
[08:30 - 09:30] Test Automation & Verification: Pytest, Playwright, Axe-core
[09:30 - 10:00] Wrap-up & Production Roadmap
```

---

### Segment 1: Introduction & The Problem Space (00:00 - 01:15)
- **Visual**: Screen on Dashboard Home (`http://localhost:3000`).
- **Talking Points**:
  - Introduce the core challenge: Organizations subscribe to dozens of software and cloud vendors (resellers, SaaS platforms, cloud infrastructure). Invoices arrive across fragmented formats (dense CSVs, complex PDFs).
  - Without automated period-over-period reconciliation, price increases, seat creep, prorated splits, and dropped licenses slip through unnoticed.
  - Present **ReconcileOps**: An enterprise billing reconciliation engine built with 100% deterministic precision.

### Segment 2: System Architecture & Decimal Precision (01:15 - 02:45)
- **Visual**: Show `docs/ARCHITECTURE.md` architecture diagram and `DecimalString` code.
- **Talking Points**:
  - Highlight the engineering principle: **Zero Floats**. Floats introduce binary rounding artifacts (`$0.10 + $0.20 = $0.30000000000000004`), which destroys financial auditability.
  - The entire backend is built in Python `Decimal` end-to-end, persisted with a custom `DecimalString` SQLAlchemy decorator.
  - Explain the mathematical invariant:
    $$\sum_{i \in \text{Changes}} \Delta\text{Amount}_i = \text{Total}_{\text{Target}} - \text{Total}_{\text{Base}}$$
    Every reconciliation balances to the cent or flags a clear discrepancy.

### Segment 3: Sherweb CSV Reconciliation Walkthrough (02:45 - 04:30)
- **Visual**: Navigate to Sherweb vendor page (`/vendors/[id]`) and click **Compare Diff** (`/vendors/[id]/compare`).
- **Talking Points**:
  - Show the July 2026 ($20,362.51) vs August 2026 ($20,982.97) comparison.
  - Walk through the Summary KPI cards:
    - Net Delta: **+$620.46** (+3.05%).
    - Reconciled Status: **100% Reconciled to the Cent**.
    - Price changes: 2 items.
    - Quantity changes: 2 items.
    - New items: 1 item.
    - Removed items: 1 item.
  - Demonstrate the filter tabs: **All Changes (6)**, **Price (2)**, **Quantity (2)**, **New Items (1)**, **Removed (1)**.
  - Demonstrate real-time search filtering across SKU, account name, and product descriptions.

### Segment 4: Expandable Row Drilldown & Prorations (04:30 - 06:15)
- **Visual**: Click on `Bayview Clinic` and `Meridian Live` rows to expand the accordion.
- **Talking Points**:
  - Explain how the reconciliation engine groups multiple prorated lines into single contract lines:
    - `Bayview Clinic`: In July, 2 rows (12 base seats + 1 prorated seat = 13 total). In August, 1 row (6 seats). The engine calculates the net change: **-$100.80** (7 seats removed at $14.40/seat).
    - `Meridian Live`: 249 seats unchanged, but unit price increased from $21.10 to $21.648 (+$0.548/seat), yielding an extra spend of **+$136.45**.
  - Highlight transparency: Operators can see the exact row numbers and raw metadata from the original invoice files.

### Segment 5: Multi-Format PDF Ingestion & Synthetic Fixture (06:15 - 07:30)
- **Visual**: Navigate to PowerDMARC vendor page and click **Compare Diff**.
- **Talking Points**:
  - In addition to structured CSVs, vendors often send vector PDF statements.
  - Show the PowerDMARC comparison between August 2026 (Real, $1,297.00) and September 2026 (Synthetic Fixture, $1,445.00).
  - Demonstrate how the PDF match-key normalizer matches items across months by stripping varying date tokens and line prefixes.
  - Point out the two isolated changes:
    1. Base Plan Rate Hike: $1,297.00 -> $1,347.00 (+$50.00).
    2. New Addon: Dedicated IP Addon (+2 domains at $49.00 = +$98.00).
  - Net Delta: **+$148.00** (100% reconciled).

### Segment 6: Multi-Sheet Excel & CSV Exports (07:30 - 08:30)
- **Visual**: Click **Export Reconciliation** -> **Excel Workbook (.xlsx)** and open the generated file.
- **Talking Points**:
  - Financial analysts live in Excel. Show the styled workbook:
    - Sheet 1 ("Reconciliation Summary"): High-level metadata, period dates, totals, and change category counts.
    - Sheet 2 ("Itemized Changes"): Color-coded delta columns, formatted currency cells (`$#,##0.00`), frozen headers, and auto-adjusted column widths.
  - Mention RFC-4180 compliant CSV export with UTF-8 BOM for universal Excel compatibility.

### Segment 7: Verification Suite & Accessibility (08:30 - 09:30)
- **Visual**: Terminal terminal output showing `uv run pytest` and `npx playwright test`.
- **Talking Points**:
  - Emphasize verifiable engineering:
    - **29 backend pytest tests** with 90% code coverage (covering unit tests, symmetry tests, mutation tests, and SHA-256 integrity).
    - **7 Playwright E2E integration tests** verifying complete user journeys.
    - **Axe-core automated accessibility audits** across all pages with **zero WCAG 2.1 AA violations**.
    - SHA-256 fixture checksums verified against `samples/SHA256SUMS`.

### Segment 8: Conclusion & Next Steps (09:30 - 10:00)
- **Visual**: Return to main dashboard in Dark Mode toggle.
- **Talking Points**:
  - Summarize achievements: High precision, multi-format parsing, proration-aware reconciliation, production-ready UI, and automated verification.
  - Ready for immediate production deployment (Docker Compose, Fly.io, Render configurations included).
