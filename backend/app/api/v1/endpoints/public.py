from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.core.database import get_session
from app.models.organization import Organization

router = APIRouter()


class LocaleOut(BaseModel):
    default_language: str


@router.get("/locale", response_model=LocaleOut)
def read_public_locale(session: Session = Depends(get_session)):
    """Unauthenticated on purpose: the login page needs to know the
    organization's language before anyone has signed in."""
    org = session.exec(select(Organization).where(Organization.id == 1)).first()
    return LocaleOut(default_language=org.default_language if org else "en")


class BrandingOut(BaseModel):
    company_name: str
    logo_url: str | None


@router.get("/branding", response_model=BrandingOut)
def read_public_branding(session: Session = Depends(get_session)):
    """Unauthenticated on purpose: the login page and the sidebar (visible
    to every staff member regardless of their permissions) both need the
    company name and logo without requiring organization.page.view."""
    org = session.exec(select(Organization).where(Organization.id == 1)).first()
    return BrandingOut(
        company_name=org.company_name if org else "Cake Studio",
        logo_url=org.logo_url if org else None,
    )
