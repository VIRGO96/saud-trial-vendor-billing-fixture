from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db.database import init_db
from app.services.seed import seed_demo_data
from app.api.vendors import router as vendors_router
from app.api.invoices import router as invoices_router
from app.api.comparison import router as comparison_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database
    init_db()
    if os.getenv("SEED_DEMO", "true").lower() in ("true", "1", "yes"):
        try:
            seed_demo_data()
        except Exception as e:
            print(f"Warning: Demo seeding failed during startup: {e}")
    yield
    # Shutdown

app = FastAPI(
    title="Vendor Billing Reconciliation API",
    version="1.0.0",
    description="High-precision multi-format vendor invoice ingestion and period-over-period reconciliation engine.",
    lifespan=lifespan
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["health"])
def health_check():
    return JSONResponse(content={"status": "ok", "version": "1.0.0"})

# Mount routers
app.include_router(vendors_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(comparison_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)