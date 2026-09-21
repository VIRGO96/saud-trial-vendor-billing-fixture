# Deployment & Operations Guide

This guide details the configuration, security gating, deployment procedures, and verification workflows for the **Vendor Billing Reconciliation Platform**.

---

## 1. Architecture Overview

The system consists of two production services orchestrated via Docker Compose:
1. **Backend API (`FastAPI`)**: High-precision ingestion, deterministic parsing, and period-over-period reconciliation engine running Python 3.12.
2. **Frontend UI (`Next.js`)**: Modern React 19 / Tailwind CSS responsive dashboard with Dark mode, Excel export, and WCAG 2.1 AA accessibility.

```
                  ┌───────────────────────────────┐
                  │   Client Browser / Client     │
                  └───────────────┬───────────────┘
                                  │ Port 3000 / 8000
                                  ▼
        ┌───────────────────────────────────────────────────┐
        │                 Docker Network                    │
        │                                                   │
        │  ┌───────────────────────┐                        │
        │  │ frontend (Next.js 15) │                        │
        │  │ Port 3000             │                        │
        │  └───────────┬───────────┘                        │
        │              │ /api/* proxy                       │
        │              ▼                                    │
        │  ┌───────────────────────┐   ┌─────────────────┐  │
        │  │ backend (FastAPI)     │──▶│ SQLite / DB     │  │
        │  │ Port 8000             │   │ vendor_billing  │  │
        │  └───────────────────────┘   └─────────────────┘  │
        └───────────────────────────────────────────────────┘
```

---

## 2. Environment Variables & Security Configuration

### Required Environment Variables

| Variable | Recommended Value (Prod) | Recommended Value (Dev/Demo) | Scope | Description & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `ENABLE_ADMIN_ENDPOINTS` | `false` | `true` | Backend | **Security Guard**: When `false`, destructive actions `DELETE /api/vendors/{id}` and `POST /api/vendors/seed` return `403 Forbidden`. Must be `false` in production. |
| `SEED_DEMO` | `true` (or `false` for empty state) | `true` | Backend | Automatically seeds Sherweb (July/August 2026) and PowerDMARC (August/September 2026) demo invoices on initial database creation. |
| `DATABASE_URL` | `postgresql://...` or `sqlite:///./data/vendor_billing.db` | `sqlite:///./vendor_billing.db` | Backend | SQLAlchemy database connection URI. |
| `BACKEND_URL` | `http://backend:8000` | `http://backend:8000` | Frontend | Upstream backend URL for Next.js server-side rendering and API route proxying. |
| `NODE_ENV` | `production` | `development` | Frontend | Node execution environment mode. |
| `SAMPLES_DIR` | `./samples` | `./samples` | Backend | Location of authoritative invoice sample files. |
| `FIXTURES_DIR` | `./fixtures` | `./fixtures` | Backend | Location of generated fixture files. |

> [!WARNING]
> **Ephemeral Disks & Storage Persistence**:
> When running containerized deployments on cloud platforms with ephemeral filesystems (e.g., standard Docker, AWS ECS Fargate, GCP Cloud Run, Heroku), local SQLite databases (`vendor_billing.db`) and uploaded files stored on the container filesystem are reset upon redeployment or container restart.
> 
> To retain uploaded invoices and reconciliation history across deployments:
> 1. Use an external managed PostgreSQL instance configured via `DATABASE_URL=postgresql://user:pass@host:5432/dbname`.
> 2. Or attach a persistent volume mount to `/app/data` when using SQLite (`DATABASE_URL=sqlite:////app/data/vendor_billing.db`).

### Destructive Endpoint Security (`ENABLE_ADMIN_ENDPOINTS`)

To protect production instances from accidental data wiping:
- In **Production**: Set `ENABLE_ADMIN_ENDPOINTS=false`. The endpoints `DELETE /api/vendors/{id}` and `POST /api/vendors/seed` are strictly disabled and return HTTP 403 Forbidden.
- In **Development / Staging / CI**: Set `ENABLE_ADMIN_ENDPOINTS=true` (or run in test mode) to allow automated E2E journey tests and seed resets.

---

## 3. Deployment via Docker Compose

### Quickstart (Local Evaluation / Demo Mode)

```bash
# Clone the repository
git clone <your-repo-url>
cd dev-trial-vendor-billing-fixtures

# Build and start the containers
docker compose up --build -d

# Verify running containers
docker compose ps

# Check backend health
curl http://localhost:8000/api/health
```

The web application is accessible at:
- **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs (OpenAPI / Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Production / Demo Configuration

In production or hosted demo instances, pre-populate demo data on cold start with `SEED_DEMO=true` while guarding destructive endpoints with `ENABLE_ADMIN_ENDPOINTS=false`:

```yaml
services:
  backend:
    environment:
      - DATABASE_URL=postgresql://user:password@postgres-host:5432/vendor_billing
      - SEED_DEMO=true
      - ENABLE_ADMIN_ENDPOINTS=false
      - ENVIRONMENT=production

  frontend:
    environment:
      - BACKEND_URL=http://backend:8000
      - NODE_ENV=production
```

> [!NOTE]
> **Database Reset & Reseeding**:
> Automated database seeding executes only upon initial database initialization when no tables or vendor records exist. If parsers or fixture schemas are updated, reset the database to trigger a fresh seed:
> - **Docker Compose**: `docker compose down -v && docker compose up --build -d`
> - **Local SQLite**: Delete `vendor_billing.db` and restart the backend.
> - **PostgreSQL**: Drop and recreate the database schema or run a migration script.

---

## 4. Cloud Deployment Step-by-Step Guides

### Deploying to Render (Web Services)

1. **Backend Service (FastAPI)**:
   - Create a new **Web Service** pointing to your repository.
   - **Environment**: Docker (`backend/Dockerfile` as Dockerfile Path, Context `.`).
   - **Health Check Path**: `/api/health`.
   - **Environment Variables**:
     - `ENABLE_ADMIN_ENDPOINTS`: `false`
     - `SEED_DEMO`: `true`
     - `DATABASE_URL`: Attach a Render Managed PostgreSQL internal connection string (or add a Render Persistent Disk mounted to `/app/data` with `DATABASE_URL=sqlite:////app/data/vendor_billing.db`).
   - Port: `8000`.

2. **Frontend Service (Next.js)**:
   - Create a second **Web Service** pointing to your repository.
   - **Environment**: Docker (`frontend/Dockerfile` as Dockerfile Path, Context `.`).
   - **Environment Variables**:
     - `BACKEND_URL`: `https://your-backend-service.onrender.com` (or internal URL `http://backend-service:8000`).
     - `NODE_ENV`: `production`
   - Port: `3000`.

---

### Deploying to Fly.io

1. **Backend Deployment (`fly.toml` for Backend)**:
   - Launch app: `fly launch --dockerfile backend/Dockerfile`
   - Set secrets/env:
     ```bash
     fly secrets set ENABLE_ADMIN_ENDPOINTS=false SEED_DEMO=true
     ```
   - Attach storage: Attach a Fly volume `fly volumes create backend_data -s 1` or connect to Fly Postgres.
   - Configure HTTP health check at path `/api/health` with grace period of `10s`.

2. **Frontend Deployment (`fly.toml` for Frontend)**:
   - Launch app: `fly launch --dockerfile frontend/Dockerfile`
   - Set upstream URL:
     ```bash
     fly secrets set BACKEND_URL=https://your-backend-app.fly.dev NODE_ENV=production
     ```
   - Next.js server proxies `/api/*` calls directly to `BACKEND_URL`.

---

## 5. Verification & Testing Workflows

### 1. In-Container Backend Tests (Python 3.12)
```bash
docker compose exec backend pytest tests -v --cov=app
```

### 2. Read-Only Live Smoke Tests (`e2e/smoke.spec.ts`)
The non-destructive smoke suite safely executes against any live URL without modifying backend state.

The configuration [`playwright.live.config.ts`](file:///D:/Client%20Repos/dev-trial-vendor-billing-fixtures/frontend/playwright.live.config.ts) dynamically resolves the target URL from the `LIVE_URL` (or `BASE_URL`) environment variable:

```bash
cd frontend

# Run smoke tests against local Compose deployment (default: http://127.0.0.1:3000)
npx playwright test --config=playwright.live.config.ts

# Or run against a remote production/staging deployment
LIVE_URL=https://your-production-app.com npx playwright test --config=playwright.live.config.ts

# Alternatively, using npm script:
npm run e2e:smoke
```

### 3. Clean-Slate Journey Test (`e2e/journey.spec.ts`)
The journey suite validates onboarding from an empty database through full multi-vendor reconciliation. It is safety-gated to execute only against `localhost` or when `E2E_ALLOW_DESTRUCTIVE=1` is explicitly set:
```bash
cd frontend
# Runs against local instance and re-seeds on completion
npx playwright test e2e/journey.spec.ts

# Running against a remote staging server with explicit authorization
E2E_ALLOW_DESTRUCTIVE=1 npx playwright test e2e/journey.spec.ts
```

### 4. Full E2E Test Suite (All 15 Tests)
```bash
cd frontend
npx playwright test
```
