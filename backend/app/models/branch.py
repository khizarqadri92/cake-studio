import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field
from app.models.organization import DEFAULT_BUSINESS_HOURS


class Branch(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    code: str = Field(unique=True, index=True)

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None

    manager_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")

    business_hours: dict = Field(default_factory=lambda: DEFAULT_BUSINESS_HOURS, sa_column=Column(JSON))
    timezone: str = Field(default="Asia/Karachi")
    currency: str = Field(default="PKR")

    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)  # only one branch should be default; enforced in service layer

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
