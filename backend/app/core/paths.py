"""Where uploaded files live - one place for the whole app."""
from pathlib import Path

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
STATIC_DIR = Path(settings.STATIC_DIR) if settings.STATIC_DIR else BACKEND_DIR / "static"
UPLOAD_DIR = STATIC_DIR / "uploads"
