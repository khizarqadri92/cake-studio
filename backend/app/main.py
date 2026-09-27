from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.endpoints import auth, system_config, permissions, staff, organization, branches, access_policy, security_logs, branch_access, public, catalog, delivery, orders, customers, inventory, reports, dashboard

# Sign-in tokens are signed with SECRET_KEY. A default or short key means
# anyone could forge a login, so production refuses to start without a real one.
if settings.ENVIRONMENT.lower() == "production" and (
    settings.SECRET_KEY in ("change-me-in-env", "replace-with-a-long-random-string") or len(settings.SECRET_KEY) < 32
):
    raise SystemExit(
        "SECRET_KEY in backend/.env is missing or too weak. Set a long random value "
        "(the installer does this for you: deploy/install.ps1)."
    )

app = FastAPI(title=settings.PROJECT_NAME)


@app.on_event("startup")
def _ensure_standard_units() -> None:
    """kg always has g, litre has ml, dozen has pieces - without needing the seed."""
    import logging
    from sqlmodel import Session
    from app.core.database import engine
    from app.services.units import ensure_standard_units
    try:
        with Session(engine) as session:
            filled, added = ensure_standard_units(session)
            if filled or added:
                logging.getLogger("uvicorn.error").info(
                    "Units: set the type on %s unit(s); added %s", filled, ", ".join(added) or "none"
                )
    except Exception as exc:  # e.g. migrations not run yet - never block startup
        logging.getLogger("uvicorn.error").warning("Skipped unit check at startup: %s", exc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(system_config.router, prefix="/api/v1/system", tags=["system-config"])
app.include_router(permissions.router, prefix="/api/v1/access", tags=["roles-and-permissions"])
app.include_router(staff.router, prefix="/api/v1/staff", tags=["staff"])
app.include_router(organization.router, prefix="/api/v1/organization", tags=["organization"])
app.include_router(branches.router, prefix="/api/v1/branches", tags=["branches"])
app.include_router(access_policy.router, prefix="/api/v1/access-policy", tags=["access-policy"])
app.include_router(security_logs.router, prefix="/api/v1", tags=["security-logs"])
app.include_router(branch_access.router, prefix="/api/v1", tags=["branch-access"])
app.include_router(public.router, prefix="/api/v1/public", tags=["public"])
app.include_router(catalog.flavors_router, prefix="/api/v1/catalog/cake-flavors", tags=["catalog"])
app.include_router(catalog.fillings_router, prefix="/api/v1/catalog/cake-fillings", tags=["catalog"])
app.include_router(catalog.frostings_router, prefix="/api/v1/catalog/cake-frostings", tags=["catalog"])
app.include_router(catalog.shapes_router, prefix="/api/v1/catalog/cake-shapes", tags=["catalog"])
app.include_router(catalog.sizes_router, prefix="/api/v1/catalog/cake-sizes", tags=["catalog"])
app.include_router(catalog.themes_router, prefix="/api/v1/catalog/themes", tags=["catalog"])
app.include_router(catalog.addons_router, prefix="/api/v1/catalog/cake-addons", tags=["catalog"])
app.include_router(catalog.boxes_router, prefix="/api/v1/catalog/cake-boxes", tags=["catalog"])
app.include_router(catalog.tiers_router, prefix="/api/v1/catalog/cake-tiers", tags=["catalog"])
app.include_router(catalog.colors_router, prefix="/api/v1/catalog/cake-colors", tags=["catalog"])
app.include_router(delivery.router, prefix="/api/v1/delivery-zones", tags=["delivery"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["inventory"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["customers"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])


@app.get("/health")
def health():
    return {"status": "ok"}



# ---------------------------------------------------------------- the web app
# In production the backend serves the built React app (frontend/dist) itself,
# so the whole system is one server on one address. Registered last so every
# /api and /static route above takes priority.
_dist = Path(settings.FRONTEND_DIST) if settings.FRONTEND_DIST else Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (_dist / "index.html").is_file():
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(_dist / "assets")), name="app-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def web_app(full_path: str):
        if full_path.startswith(("api/", "static/", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404)
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and _dist.resolve() in candidate.parents:
            return FileResponse(candidate)          # favicon, robots.txt ...
        return FileResponse(_dist / "index.html")   # every app page (/admin/orders ...) is the SPA
