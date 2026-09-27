import uuid
from datetime import date, datetime, timezone
from sqlmodel import SQLModel, Field


class SystemConfig(SQLModel, table=True):
    """Single-row table holding system-operational settings.

    Business profile (name, address, branding, locale) lives in Organization
    instead — this table is only for how the system itself behaves.
    All modules must read `current_processing_date` through the
    processing_date service instead of calling the OS clock directly.
    """

    id: int = Field(default=1, primary_key=True)
    current_processing_date: date = Field(default_factory=date.today)
    fiscal_year_start_month: int = Field(default=1)
    is_day_locked: bool = Field(default=False)
    # Where "today" comes from, everywhere in the system:
    #   "processing": current_processing_date, set and advanced by hand (default)
    #   "system":     the computer's calendar date in the organisation's time zone
    date_mode: str = Field(default="processing")
    # Decimal places: money (prices, totals, payments) and quantities (stock,
    # ingredients). Money is rounded to this when saved; quantities keep full
    # precision internally and are only rounded for display.
    amount_decimals: int = Field(default=2)
    quantity_decimals: int = Field(default=3)
    # Kitchen ticket printing on order confirmation.
    #   "browser": the kitchen ticket opens in the browser's print dialog
    #   "network": the server sends it straight to an ESC/POS receipt printer
    #   "off":     no automatic printing (tickets can still be printed by hand)
    printer_mode: str = Field(default="browser")
    printer_host: str | None = None
    printer_port: int = Field(default=9100)
    printer_width: int = Field(default=48)  # characters per line: 48 for 80 mm paper, 32 for 58 mm
    # Country calling code for WhatsApp links to customers ("0300..." -> "92300...")
    phone_country_code: str = Field(default="92")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProcessingDateLog(SQLModel, table=True):
    """Audit trail every time the processing date is advanced or changed."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    old_date: date
    new_date: date
    changed_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
    reason: str | None = None
    changed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
