import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class Customer(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    full_name: str
    phone: str = Field(unique=True, index=True)  # primary search/dedup key
    email: str | None = None
    address_line1: str | None = None
    city: str | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
