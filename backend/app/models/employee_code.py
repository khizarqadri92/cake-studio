from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class EmployeeCodeSettings(SQLModel, table=True):
    """Controls how auto-generated employee codes are formatted.

    Produces codes like: EMP-0001, or EMP-2026-0001 if include_year is on.
    next_sequence advances every time a code is generated - never edited
    directly by an admin, only prefix/separator/padding/include_year are.
    """

    id: int = Field(default=1, primary_key=True)
    prefix: str = Field(default="EMP")
    separator: str = Field(default="-")
    padding: int = Field(default=4)
    include_year: bool = Field(default=False)
    next_sequence: int = Field(default=1)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
