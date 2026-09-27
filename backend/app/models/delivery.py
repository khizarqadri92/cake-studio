import uuid
from sqlmodel import SQLModel, Field


class DeliveryZone(SQLModel, table=True):
    """A distance bracket with its own delivery price - e.g. 0-5km: Rs 200,
    5-10km: Rs 350. Kept as its own model rather than the generic named
    catalog since the fields (distance range) don't fit that shape."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str | None = None  # optional label, e.g. "Zone A - Nearby"
    distance_from_km: float
    distance_to_km: float
    price: float = Field(default=0)
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
