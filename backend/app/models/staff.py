import uuid
from datetime import date, datetime, timezone
from sqlmodel import SQLModel, Field


class Staff(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    full_name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # profile
    phone: str | None = None
    job_title: str | None = None
    department: str | None = None
    employee_code: str | None = Field(default=None, unique=True, index=True)
    date_of_joining: date | None = None
    date_of_birth: date | None = None
    gender: str | None = None  # "male" | "female" | "other"
    national_id: str | None = None  # CNIC / passport / national ID number
    employment_type: str | None = None  # "full_time" | "part_time" | "contract" | "intern"
    basic_salary: float | None = None

    address_line1: str | None = None
    city: str | None = None
    country: str | None = None

    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None

    # Which branch this staff member works at. None means org-wide (not
    # restricted to a single branch - e.g. Super Admin, Accountant covering
    # all locations). When set, this staff member can only act on this one
    # branch's data, regardless of what their role would otherwise allow.
    branch_id: uuid.UUID | None = Field(default=None, foreign_key="branch.id")

    # security / access control
    failed_login_attempts: int = Field(default=0)
    locked_until: datetime | None = None
    password_updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    totp_secret: str | None = None
    totp_enabled: bool = Field(default=False)

    # Personal override on top of the organization's default language.
    # None means "use the organization's default" - set explicitly here
    # only when this specific staff member picks their own language.
    preferred_language: str | None = None

    # "light" | "dark" | "system" | None (None behaves like "system")
    theme_preference: str | None = None

    # Palette id (e.g. "plum", "ocean", "forest", "berry", "slate") or None
    # meaning the default "plum" palette.
    color_palette: str | None = None


class Role(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None


class StaffRole(SQLModel, table=True):
    """Link table: a staff member can hold more than one role."""

    staff_id: uuid.UUID = Field(foreign_key="staff.id", primary_key=True)
    role_id: uuid.UUID = Field(foreign_key="role.id", primary_key=True)
