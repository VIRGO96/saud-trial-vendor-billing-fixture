# Vendor Billing Reconciliation

> High-precision, multi-format vendor invoice ingestion and period-over-period financial reconciliation platform.

---

## Overview

Modern businesses receive disparate monthly invoices across multiple vendors in varied formats (CSV, multi-line PDF). Price hikes, seat changes, dropped subscriptions, and prorations often slip through without automated reconciliation.

**Vendor Billing Reconciliation** provides:
- **Universal Multi-Format Ingestion**: Ingests CSVs and complex multi-line PDFs with automatic vendor and metadata detection.
- **Deterministic Reconciliation Engine**: Groups prorated line items, metered usage, and credit adjustments into normalized account/item groupings.
- **Precision Auditing**: Detects price increases/decreases, quantity fluctuations, new subscriptions, and dropped services with zero false positives.
- **Strict Money Handling**: End-to-end `Decimal` representation prevents IEEE 754 floating-point rounding inaccuracies.
- **Production-Grade SaaS UI**: Built with Next.js 15, Tailwind CSS, TanStack Table, shadcn/ui components, and light/dark theme support.
- **Professional Exports**: Multi-tab formatted Excel (`.xlsx`) workbooks and UTF-8 BOM CSVs ready for finance teams.

---

## Quick Start

### Option 1: One-Command Docker Compose (Recommended)

```bash
docker-compose up --build
```
- **Web UI**: http://localhost:3000
- **FastAPI OpenAPI Docs**: http://localhost:8000/docs
- Pre-seeded with Sherweb July/August and PowerDMARC samples when `SEED_DEMO=true`.

### Option 2: Local Development

#### 1. Backend (FastAPI + Python)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or `.venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (Next.js 15 + TypeScript)
```bash
cd frontend
npm install
npm run dev
```

---

## Testing

### Backend Unit, Property & Mutation Tests
```bash
cd backend
pytest tests -v --cov=app --cov-report=term-missing
```

### End-to-End & Accessibility Tests
```bash
cd frontend
npm run test:e2e
```

---

## Architecture & Documentation

- [Architecture Design & Decisions](docs/ARCHITECTURE.md)
- [Scope & Cut List](docs/CUT_LIST.md)
- [Loom Walkthrough Script](docs/LOOM_OUTLINE.md)
- [Verification & Test Evidence](docs/VERIFICATION.md)
- [Deployment Guide](DEPLOY.md)
