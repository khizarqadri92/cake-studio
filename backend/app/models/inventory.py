import uuid
from datetime import date, datetime, timezone
from sqlmodel import SQLModel, Field


class UnitOfMeasure(SQLModel, table=True):
    """Configurable unit list (kg, g, l, ml, pcs, dozen, etc.) instead of
    free text, so it's consistent across ingredients and easy to administer."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)  # e.g. "Kilogram"
    abbreviation: str  # e.g. "kg"
    # What this unit measures, and how big it is relative to the smallest unit
    # of that kind (g=1, kg=1000; ml=1, l=1000; pcs=1, dozen=12). Units that
    # share a measure can be converted into each other; a unit with no
    # measure set only ever converts to itself.
    measure: str | None = None  # "weight" | "volume" | "count"
    factor: float = Field(default=1.0)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class Supplier(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    contact_phone: str | None = None


class InventoryItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    unit: str | None = None  # deprecated free-text unit, kept only for old rows
    unit_id: uuid.UUID | None = Field(default=None, foreign_key="unitofmeasure.id")
    qty_on_hand: float = Field(default=0)
    reorder_threshold: float = Field(default=0)
    supplier_id: uuid.UUID | None = Field(default=None, foreign_key="supplier.id")
    is_active: bool = Field(default=True)


class StockMovement(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inventory_item_id: uuid.UUID = Field(foreign_key="inventoryitem.id")
    qty_delta: float  # positive = stock in, negative = stock out
    reason: str  # purchase, production_use, wastage, adjustment, initial_stock
    unit_price: float | None = None  # cost per unit, when known (e.g. from a purchase)
    purchase_id: uuid.UUID | None = Field(default=None, foreign_key="purchase.id")
    processing_date: date
    created_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Purchase(SQLModel, table=True):
    """Header for a purchase transaction - buying a batch of ingredients,
    often from one supplier in one trip/invoice."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    supplier_id: uuid.UUID | None = Field(default=None, foreign_key="supplier.id")
    invoice_number: str | None = None
    purchase_date: date
    notes: str | None = None
    total_amount: float = Field(default=0)
    created_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PurchaseItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    purchase_id: uuid.UUID = Field(foreign_key="purchase.id")
    inventory_item_id: uuid.UUID = Field(foreign_key="inventoryitem.id")
    quantity: float     # in the ingredient's own stock unit (what stock went up by)
    unit_price: float   # per stock unit, so stock valuation is consistent
    line_total: float
    # What was actually typed on the purchase, e.g. 500 "g" at 0.40 per g
    entered_quantity: float | None = None
    entered_unit: str | None = None
    entered_unit_price: float | None = None


class Recipe(SQLModel, table=True):
    """Bill of materials for a cake product/template."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str


class RecipeItem(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipe_id: uuid.UUID = Field(foreign_key="recipe.id")
    inventory_item_id: uuid.UUID = Field(foreign_key="inventoryitem.id")
    qty_required: float
