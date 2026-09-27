import uuid
from datetime import date, datetime, timezone
from enum import Enum
from sqlmodel import SQLModel, Field


class OrderStatus(str, Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    SENT_TO_BAKER = "sent_to_baker"
    IN_PRODUCTION = "in_production"
    READY = "ready"
    RIDER_ASSIGNED = "rider_assigned"      # in the rider's queue, not yet left
    OUT_FOR_DELIVERY = "out_for_delivery"  # rider has started the trip
    DELIVERED = "delivered"                # handed to customer; rider still holds the cash
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class FulfillmentType(str, Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"


class Order(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_number: str = Field(unique=True, index=True)  # auto-generated, e.g. ORD-0001

    customer_id: uuid.UUID = Field(foreign_key="customer.id")
    branch_id: uuid.UUID | None = Field(default=None, foreign_key="branch.id")

    status: OrderStatus = Field(default=OrderStatus.DRAFT)

    fulfillment_type: FulfillmentType = Field(default=FulfillmentType.PICKUP)
    delivery_zone_id: uuid.UUID | None = Field(default=None, foreign_key="deliveryzone.id")
    delivery_address: str | None = None
    delivery_date: date
    delivery_time: str | None = None  # free-form "14:00", kept simple for now

    subtotal: float = Field(default=0)
    delivery_charge: float = Field(default=0)
    discount: float = Field(default=0)
    total: float = Field(default=0)
    advance_paid: float = Field(default=0)

    notes: str | None = None

    created_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # The processing (business) date the order was taken on - used on receipts
    # and reports instead of the computer clock.
    business_date: date | None = None

    confirmed_at: datetime | None = None
    confirmed_by_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    sent_to_baker_at: datetime | None = None
    sent_to_baker_by_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")
    baker_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")  # who it's queued to

    # Baker must explicitly accept an assignment before they can start baking.
    # If they decline, the order goes back to CONFIRMED with the baker cleared,
    # and the reason stays here so the manager can see why before reassigning.
    baker_accepted_at: datetime | None = None
    decline_reason: str | None = None
    declined_at: datetime | None = None
    declined_by_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")

    production_started_at: datetime | None = None
    ready_at: datetime | None = None

    rider_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")  # assigned for delivery
    assigned_rider_at: datetime | None = None
    delivery_started_at: datetime | None = None
    delivered_at: datetime | None = None
    rider_amount_collected: float | None = None  # what the rider says they collected from the customer

    amount_received: float | None = None  # collected at handover/delivery
    handover_at: datetime | None = None
    handover_by_staff_id: uuid.UUID | None = Field(default=None, foreign_key="staff.id")


class OrderIngredientUsage(SQLModel, table=True):
    """Ingredients (and quantities) the baker recorded as used for this
    order. Recording usage also deducts the same quantity from the
    inventory item's stock on hand via a StockMovement."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_id: uuid.UUID = Field(foreign_key="order.id")
    inventory_item_id: uuid.UUID = Field(foreign_key="inventoryitem.id")
    quantity_used: float  # always in the ingredient's own stock unit
    # What the baker actually typed, e.g. 500 "g" for a kg ingredient
    entered_quantity: float | None = None
    entered_unit: str | None = None
    processing_date: date | None = None  # business date the ingredient was used on
    recorded_by_staff_id: uuid.UUID = Field(foreign_key="staff.id")
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderItem(SQLModel, table=True):
    """MVP: one item per order (enforced in the API layer, not the schema -
    the table itself already supports multiple items per order for when
    a multi-cake order form gets built later)."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_id: uuid.UUID = Field(foreign_key="order.id")

    cake_flavor_id: uuid.UUID | None = Field(default=None, foreign_key="cakeflavor.id")
    cake_filling_id: uuid.UUID | None = Field(default=None, foreign_key="cakefilling.id")
    cake_frosting_id: uuid.UUID | None = Field(default=None, foreign_key="cakefrosting.id")
    cake_shape_id: uuid.UUID | None = Field(default=None, foreign_key="cakeshape.id")
    cake_size_id: uuid.UUID | None = Field(default=None, foreign_key="cakesize.id")
    theme_id: uuid.UUID | None = Field(default=None, foreign_key="theme.id")
    cake_box_id: uuid.UUID | None = Field(default=None, foreign_key="cakebox.id")
    cake_tier_id: uuid.UUID | None = Field(default=None, foreign_key="caketier.id")
    cake_color_id: uuid.UUID | None = Field(default=None, foreign_key="cakecolor.id")

    custom_message: str | None = None
    special_instructions: str | None = None

    # Customer supplied their own reference design (photo of a cake they
    # want). When true, reference_image_url holds the uploaded image -
    # shown on the order detail view so the baker can see what to make.
    is_customer_design: bool = Field(default=False)
    reference_image_url: str | None = None

    quantity: int = Field(default=1)
    unit_price: float = Field(default=0)  # sum of component price modifiers, per cake
    line_total: float = Field(default=0)  # (unit_price * quantity) + addons total


class OrderItemAddon(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    order_item_id: uuid.UUID = Field(foreign_key="orderitem.id")
    addon_id: uuid.UUID = Field(foreign_key="cakeaddon.id")
    quantity: int = Field(default=1)
    unit_price: float = Field(default=0)  # snapshot of the addon's price at order time


class OrderSequence(SQLModel, table=True):
    """Singleton counter for order numbers - kept separate from any given
    order so numbers stay stable and gapless even if an order is deleted."""

    id: int = Field(default=1, primary_key=True)
    next_number: int = Field(default=1)
