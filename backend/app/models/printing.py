import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class PrintJob(SQLModel, table=True):
    """Every kitchen-ticket print attempt, so staff can see whether the
    kitchen actually got the ticket and reprint if not."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_id: uuid.UUID = Field(foreign_key="order.id", index=True)
    kind: str = Field(default="kitchen_ticket")
    reason: str = Field(default="confirmation")   # "confirmation" | "reprint" | "test"
    mode: str                                     # "network" | "browser"
    status: str                                   # "sent" | "failed" | "browser"
    error: str | None = None
    printer: str | None = None                    # "192.168.1.50:9100" for network jobs
    created_by_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
