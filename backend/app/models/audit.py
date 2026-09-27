import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


class LoginHistory(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    attempted_email: str
    staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    success: bool
    failure_reason: str | None = None  # invalid_credentials, account_locked, ip_restricted, totp_required, totp_invalid
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditLog(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    actor_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    action: str  # e.g. "staff.created", "role.permissions_changed", "account.locked", "2fa.enabled"
    target_type: str | None = None
    target_id: str | None = None
    details: dict | None = Field(default=None, sa_column=Column(JSON))
    ip_address: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
