# Conscious Cut List & Scope Boundaries

This document records the deliberate architectural and feature scope boundaries established for this paid trial deliverable, detailing the rationale for each cut and the recommended implementation path for subsequent enterprise phases.

---

## 1. Feature Cuts & Rationale

### 1. Multi-Tenant User Authentication & RBAC (Role-Based Access Control)
- **Status**: Cut / Deferred.
- **Rationale**: The client trial focuses on core reconciliation correctness, parser resilience, mathematical determinism, and UI usability. Embedding user sign-up, JWT token refresh rotations, and team permissions introduces boilerplate complexity without validating the core domain value.
- **Production Path**: Integrate Auth0 / NextAuth / Clerk or FastAPI OAuth2 with OpenID Connect, scoping vendors to `workspace_id` or `tenant_id`.

### 2. Optical Character Recognition (OCR) for Scanned Paper Documents
- **Status**: Cut / Deferred.
- **Rationale**: The provided client sample files and enterprise software vendors (Sherweb, Microsoft, PowerDMARC, AWS, Datadog) generate digital vector PDFs and CSV billing exports. Tesseract/AWS Textract OCR introduces probabilistic character errors (e.g. reading `$1,297.00` as `$1,297.08` due to image noise).
- **Production Path**: Integrate an asynchronous OCR fallback pipeline (AWS Textract or Azure Document Intelligence) triggered only when digital PDF text extraction yields zero font glyphs.

### 3. ERP & Accounting Webhook Integrations (QuickBooks, NetSuite, Xero)
- **Status**: Cut / Deferred.
- **Rationale**: Financial controllers in pilot evaluations require downloadable Excel (`.xlsx`) and CSV exports for review before pushing entries into general ledger software.
- **Production Path**: Add an outbound Webhook Dispatcher and OAuth2 connectors for QuickBooks Online and NetSuite SuiteTalk API.

### 4. Custom Anomaly Detection ML Models
- **Status**: Cut / Replaced with Deterministic Threshold Rules.
- **Rationale**: Statistical ML models (e.g. Isolation Forests, Autoencoders) are opaque and can trigger false alerts on legitimate seasonal spikes. Financial auditors demand explainable, 100% deterministic rules (exact unit price delta, exact seat count change, and percentage shift).
- **Production Path**: Add configurable alert rules per vendor (e.g. "Notify if unit price increases by > 5% or monthly delta exceeds $500").

### 5. Asynchronous Task Queue (Celery / Redis / RQ)
- **Status**: Cut / Handled In-Process with Asyncio.
- **Rationale**: Parsing 250–1,000 row CSVs and vector PDFs takes under 50 milliseconds in Python. Introducing Redis and Celery daemon processes adds operational complexity to local evaluations and Docker Compose setups without measurable user benefit.
- **Production Path**: Spin up Redis + Celery worker pools when batch ingesting thousands of multi-gigabyte cloud usage files simultaneously.

### 6. Multi-Page Continuous Table Stitching for Arbitrary Vendor Formats
- **Status**: Multi-page PDFs supported via per-page coordinate table extraction; Arbitrary cross-page split rows deferred.
- **Rationale**: Digital PDF parsing extracts tables across all pages in multi-page documents (supported in `PowerDMARCPDFParser`). Complex multi-page invoices with tables that break mid-row without repeated column headers across dozens of pages are deferred to dedicated vendor parser templates.
- **Production Path**: Implement a continuous coordinate bounding box stitcher using `pdfplumber` line-edge detection or Camelot for variable-height table paginations.

---

## 2. Technical Debt & Scope Audit Matrix

| Item | Trial Deliverable Approach | Production Phase Recommendation |
| :--- | :--- | :--- |
| **Database Engine** | SQLite (with DecimalString & StaticPool) / Postgres-ready | Managed PostgreSQL on AWS RDS or Supabase |
| **Parser Dispatch** | Registry with heuristic scoring & extension match | Dynamic plugin loader with user-definable regex YAML templates |
| **Multi-Page PDFs** | Per-page spatial coordinate extraction | Continuous multi-page table edge reconstructor |
| **File Storage** | Direct multipart upload & in-memory parsing | Amazon S3 / Cloudflare R2 with presigned URLs |
| **Notifications** | Real-time UI badges, summary alert cards | Slack webhooks, email summaries via Resend/SendGrid |
| **Caching** | Next.js server component caching & browser caching | Redis query cache for large historical comparisons |

