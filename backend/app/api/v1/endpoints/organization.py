import uuid
from datetime import datetime, timezone
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
from app.models.organization import Organization

router = APIRouter()

from app.core.paths import UPLOAD_DIR
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/x-icon", "image/svg+xml", "image/webp"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2MB


class OrganizationOut(BaseModel):
    id: int
    company_name: str
    legal_name: str | None
    registration_number: str | None
    tax_number: str | None
    business_type: str | None
    industry: str | None
    logo_url: str | None
    favicon_url: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    country: str | None
    postal_code: str | None
    phone_primary: str | None
    phone_secondary: str | None
    email_primary: str | None
    email_secondary: str | None
    website_url: str | None
    business_hours: dict
    timezone: str
    default_language: str
    default_currency: str
    date_format: str
    time_format: str
    number_format: str


class IdentityUpdate(BaseModel):
    company_name: str
    legal_name: str | None = None
    registration_number: str | None = None
    tax_number: str | None = None
    business_type: str | None = None
    industry: str | None = None


class ContactUpdate(BaseModel):
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    phone_primary: str | None = None
    phone_secondary: str | None = None
    email_primary: str | None = None
    email_secondary: str | None = None
    website_url: str | None = None


class HoursUpdate(BaseModel):
    business_hours: dict
    timezone: str


class LocaleUpdate(BaseModel):
    default_language: str
    default_currency: str
    date_format: str
    time_format: str
    number_format: str


def _get_or_create(session: Session) -> Organization:
    org = session.exec(select(Organization).where(Organization.id == 1)).first()
    if not org:
        org = Organization(id=1)
        session.add(org)
        session.commit()
        session.refresh(org)
    return org


@router.get("", response_model=OrganizationOut)
def get_organization(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.page.view")),
):
    return _get_or_create(session)


@router.put("/identity", response_model=OrganizationOut)
def update_identity(
    payload: IdentityUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.identity.edit")),
):
    org = _get_or_create(session)
    for key, value in payload.model_dump().items():
        setattr(org, key, value)
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


@router.put("/contact", response_model=OrganizationOut)
def update_contact(
    payload: ContactUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.contact.edit")),
):
    org = _get_or_create(session)
    for key, value in payload.model_dump().items():
        setattr(org, key, value)
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


@router.put("/hours", response_model=OrganizationOut)
def update_hours(
    payload: HoursUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.hours.edit")),
):
    org = _get_or_create(session)
    org.business_hours = payload.business_hours
    org.timezone = payload.timezone
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


@router.put("/locale", response_model=OrganizationOut)
def update_locale(
    payload: LocaleUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.locale.edit")),
):
    org = _get_or_create(session)
    for key, value in payload.model_dump().items():
        setattr(org, key, value)
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


async def _save_image(file: UploadFile, subfolder: str) -> str:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 2MB")

    ext = Path(file.filename or "").suffix or ".png"
    filename = f"{uuid.uuid4()}{ext}"
    dest_dir = UPLOAD_DIR / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / filename).write_bytes(contents)
    return f"/static/uploads/{subfolder}/{filename}"


@router.post("/logo", response_model=OrganizationOut)
async def upload_logo(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.branding.edit")),
):
    org = _get_or_create(session)
    org.logo_url = await _save_image(file, "logos")
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org


@router.post("/favicon", response_model=OrganizationOut)
async def upload_favicon(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("organization.field.branding.edit")),
):
    org = _get_or_create(session)
    org.favicon_url = await _save_image(file, "favicons")
    org.updated_at = datetime.now(timezone.utc)
    session.add(org)
    session.commit()
    session.refresh(org)
    return org
