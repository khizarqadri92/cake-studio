import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


class SecuritySettings(SQLModel, table=True):
    """Single-row table holding org-wide access-control policy."""

    id: int = Field(default=1, primary_key=True)

    # password policy
    password_min_length: int = Field(default=8)
    password_require_uppercase: bool = Field(default=True)
    password_require_number: bool = Field(default=True)
    password_require_symbol: bool = Field(default=False)
    password_expiry_days: int = Field(default=0)  # 0 = passwords never expire

    # login / lockout
    max_login_attempts: int = Field(default=5)
    lockout_duration_minutes: int = Field(default=15)
    session_timeout_minutes: int = Field(default=480)  # 8 hour shift by default

    # 2FA
    require_2fa: bool = Field(default=False)  # org-wide enforcement; individual staff can also opt in regardless

    # IP restriction — empty list means no restriction
    ip_allowlist: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # default role assigned when creating a new staff member, if none is chosen
    default_role_id: uuid.UUID | None = Field(default=None, foreign_key="role.id")

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LoginHistory(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    email_attempted: str
    success: bool
    failure_reason: str | None = None  # bad_password, locked_out, inactive, 2fa_failed, etc.
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditLog(SQLModel, table=True):
    """Records administrative actions: who did what, to what, and when.

    Wired into the most sensitive endpoints (roles, permissions, staff,
    security policy, organization/branch changes). Extend the same
    log_audit() call into other endpoints as they're added.
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    actor_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    action: str  # e.g. "role.permissions_updated", "staff.created"
    entity_type: str  # e.g. "role", "staff", "branch"
    entity_id: str | None = None
    details: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
