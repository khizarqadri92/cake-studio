import uuid
from sqlmodel import SQLModel, Field


class CakeFlavor(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeFilling(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeFrosting(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeShape(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeSize(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)  # e.g. "6 inch", "8 inch"
    servings: int | None = None
    price_modifier: float = Field(default=0)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class Theme(SQLModel, table=True):
    """Theme / occasion - Birthday, Wedding, Baby Shower, etc."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeAddon(SQLModel, table=True):
    """Decorations / add-ons - toppers, sprinkles, edible flowers, etc.
    Unlike the other catalogs these support a quantity per order, so
    price is flat rather than a modifier, and max_qty caps how many of
    this add-on can go on one order item."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price: float = Field(default=0)
    max_qty: int = Field(default=1)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeTier(SQLModel, table=True):
    """Number of tiers on the cake - 1-tier, 2-tier, 3-tier, etc."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)  # e.g. "2-tier"
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeColor(SQLModel, table=True):
    """Cake/icing color choice - e.g. Pastel Pink, Gold, Classic White."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)


class CakeBox(SQLModel, table=True):
    """Packaging box used to box up the finished cake for pickup/delivery.
    Same shape as flavour/filling/etc - a named, priced catalog item."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True)  # e.g. "8 inch box", "2-tier box"
    description: str | None = None
    price_modifier: float = Field(default=0)
    image_url: str | None = None
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
