import uuid
from datetime import date, datetime, timezone
from sqlmodel import SQLModel, Field


class Invoice(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_id: uuid.UUID = Field(foreign_key="order.id")
    amount: float
    processing_date: date
    is_paid: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Payment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    invoice_id: uuid.UUID = Field(foreign_key="invoice.id")
    amount: float
    method: str  # cash, card, bank_transfer
    processing_date: date
    received_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")


class Expense(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    category: str  # ingredients, utilities, salaries, rent, other
    amount: float
    description: str | None = None
    processing_date: date
    recorded_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
