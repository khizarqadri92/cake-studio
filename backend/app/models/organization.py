from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field

DEFAULT_BUSINESS_HOURS = {
    day: {"open": "09:00", "close": "18:00", "closed": False}
    for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
}


class Organization(SQLModel, table=True):
    """Single-row table holding company/organization identity and settings.

    Fields are grouped into logical sections (identity, branding, contact,
    hours, locale) — permission keys are granted at the section level rather
    than per individual field, since a per-field permission for ~25 fields
    would be unmanageable to administer without adding real security value.
    """

    id: int = Field(default=1, primary_key=True)

    # --- identity ---
    company_name: str = Field(default="Cake Studio")
    legal_name: str | None = None
    registration_number: str | None = None
    tax_number: str | None = None  # VAT / GST / Tax ID
    business_type: str | None = None  # sole proprietorship, LLC, corporation, etc.
    industry: str | None = None

    # --- branding ---
    logo_url: str | None = None
    favicon_url: str | None = None

    # --- contact / address ---
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

    # --- hours / timezone ---
    business_hours: dict = Field(default_factory=lambda: DEFAULT_BUSINESS_HOURS, sa_column=Column(JSON))
    timezone: str = Field(default="Asia/Karachi")

    # --- locale ---
    default_language: str = Field(default="en")
    default_currency: str = Field(default="PKR")
    date_format: str = Field(default="DD/MM/YYYY")
    time_format: str = Field(default="hh:mm A")  # e.g. "hh:mm A" (12-hour) or "HH:mm" (24-hour)
    number_format: str = Field(default="1,234.56")  # representative sample of the chosen format

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
