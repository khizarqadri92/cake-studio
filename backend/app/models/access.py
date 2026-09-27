import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class AccessPolicy(SQLModel, table=True):
    """Single-row table holding system-wide access and security rules."""

    id: int = Field(default=1, primary_key=True)

    default_role_id: uuid.UUID | None = Field(default=None, foreign_key="role.id")

    # password policy
    password_min_length: int = Field(default=8)
    password_require_uppercase: bool = Field(default=True)
    password_require_number: bool = Field(default=True)
    password_require_symbol: bool = Field(default=False)
    password_expiry_days: int = Field(default=0)  # 0 = never expires

    # login attempts / lockout
    max_login_attempts: int = Field(default=5)
    lockout_duration_minutes: int = Field(default=15)

    # session
    session_timeout_minutes: int = Field(default=480)  # 8 hour shift

    # two-factor
    two_factor_required: bool = Field(default=False)  # org-wide nudge, not hard-blocked in phase 1

    # IP restrictions - comma separated IPs or CIDR blocks; empty = unrestricted
    ip_allowlist: str | None = None

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
