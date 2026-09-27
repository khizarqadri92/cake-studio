import uuid
from datetime import date, datetime, timezone
from pydantic import BaseModel, model_validator
from dataclasses import asdict
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlmodel import Session, select, or_
from app.core.database import get_session
from app.core.permissions import require_permission
from app.services.order_number import generate_order_number
from app.services.processing_date import get_processing_date
from app.services.audit import log_audit
from app.services.uploads import save_uploaded_image
from app.models.orders import Order, OrderItem, OrderItemAddon, OrderIngredientUsage, OrderStatus, FulfillmentType
from app.models.customer import Customer
from app.models.catalog import CakeFlavor, CakeFilling, CakeFrosting, CakeShape, CakeSize, Theme, CakeBox, CakeAddon, CakeTier, CakeColor
from app.models.delivery import DeliveryZone
from app.models.inventory import InventoryItem, StockMovement
from app.api.v1.endpoints.inventory import unit_label, unit_options
from app.services.number_format import round_amount
from app.models.printing import PrintJob
from app.services.receipt import (
    build_receipt, escpos_bytes, printer_settings, render_pdf, render_ticket_pdf, send_to_network_printer, ticket_lines,
)
from app.models.staff import Staff, Role, StaffRole
from app.api.v1.endpoints.customers import CustomerCreate

router = APIRouter()


@router.post("/upload-reference-image")
async def upload_reference_image(
    file: UploadFile = File(...),
    _staff_id: str = Depends(require_permission("orders.button.create")),
):
    """Uploads a customer-supplied design photo and returns its URL. Call
    this first, then pass the returned url as item.reference_image_url
    when creating or updating the order."""
    url = await save_uploaded_image(file, "order-references")
    return {"url": url}


class OrderItemAddonIn(BaseModel):
    addon_id: uuid.UUID
    quantity: int = 1


class OrderItemIn(BaseModel):
    cake_flavor_id: uuid.UUID | None = None
    cake_filling_id: uuid.UUID | None = None
    cake_frosting_id: uuid.UUID | None = None
    cake_shape_id: uuid.UUID | None = None
    cake_size_id: uuid.UUID | None = None
    theme_id: uuid.UUID | None = None
    cake_box_id: uuid.UUID | None = None
    cake_tier_id: uuid.UUID | None = None
    cake_color_id: uuid.UUID | None = None
    custom_message: str | None = None
    special_instructions: str | None = None
    is_customer_design: bool = False
    reference_image_url: str | None = None  # set via /orders/upload-reference-image first
    quantity: int = 1
    addons: list[OrderItemAddonIn] = []


class OrderIn(BaseModel):
    customer_id: uuid.UUID | None = None
    new_customer: CustomerCreate | None = None

    branch_id: uuid.UUID | None = None
    fulfillment_type: FulfillmentType = FulfillmentType.PICKUP
    delivery_zone_id: uuid.UUID | None = None
    delivery_address: str | None = None
    delivery_date: date
    delivery_time: str | None = None

    discount: float = 0
    advance_paid: float = 0
    notes: str | None = None

    item: OrderItemIn

    @model_validator(mode="after")
    def check_customer(self):
        if not self.customer_id and not self.new_customer:
            raise ValueError("Either customer_id or new_customer must be provided")
        return self


class OrderListOut(BaseModel):
    id: uuid.UUID
    order_number: str
    customer_name: str
    customer_phone: str
    status: OrderStatus
    fulfillment_type: FulfillmentType
    delivery_date: date
    total: float
    baker_staff_id: uuid.UUID | None
    baker_name: str | None
    baker_accepted_at: datetime | None
    decline_reason: str | None
    rider_staff_id: uuid.UUID | None
    rider_name: str | None
    created_at: datetime


class OrderItemOut(BaseModel):
    cake_flavor_id: uuid.UUID | None
    cake_flavor_name: str | None
    cake_filling_id: uuid.UUID | None
    cake_filling_name: str | None
    cake_frosting_id: uuid.UUID | None
    cake_frosting_name: str | None
    cake_shape_id: uuid.UUID | None
    cake_shape_name: str | None
    cake_size_id: uuid.UUID | None
    cake_size_name: str | None
    theme_id: uuid.UUID | None
    theme_name: str | None
    cake_box_id: uuid.UUID | None
    cake_box_name: str | None
    cake_tier_id: uuid.UUID | None
    cake_tier_name: str | None
    cake_color_id: uuid.UUID | None
    cake_color_name: str | None
    custom_message: str | None
    special_instructions: str | None
    is_customer_design: bool
    reference_image_url: str | None
    quantity: int
    unit_price: float
    line_total: float
    addons: list[dict]


class OrderOut(BaseModel):
    id: uuid.UUID
    order_number: str
    customer_id: uuid.UUID
    customer_name: str
    customer_phone: str
    branch_id: uuid.UUID | None
    status: OrderStatus
    fulfillment_type: FulfillmentType
    delivery_zone_id: uuid.UUID | None
    delivery_address: str | None
    delivery_date: date
    delivery_time: str | None
    subtotal: float
    delivery_charge: float
    discount: float
    total: float
    advance_paid: float
    notes: str | None
    baker_staff_id: uuid.UUID | None
    baker_name: str | None
    baker_accepted_at: datetime | None
    decline_reason: str | None
    declined_at: datetime | None
    declined_by_name: str | None
    confirmed_at: datetime | None
    sent_to_baker_at: datetime | None
    production_started_at: datetime | None
    ready_at: datetime | None
    rider_staff_id: uuid.UUID | None
    rider_name: str | None
    assigned_rider_at: datetime | None
    delivery_started_at: datetime | None
    delivered_at: datetime | None
    rider_amount_collected: float | None
    amount_received: float | None
    handover_at: datetime | None
    created_at: datetime
    business_date: date | None = None
    item: OrderItemOut | None
    latest_print: "PrintJobOut | None" = None


class PrintJobOut(BaseModel):
    id: uuid.UUID
    reason: str
    mode: str
    status: str
    error: str | None
    printer: str | None
    created_at: datetime


OrderOut.model_rebuild()


def _catalog_price(session: Session, model, item_id: uuid.UUID | None, field: str = "price_modifier") -> float:
    if not item_id:
        return 0
    obj = session.get(model, item_id)
    return getattr(obj, field, 0) if obj else 0


def _catalog_name(session: Session, model, item_id: uuid.UUID | None) -> str | None:
    if not item_id:
        return None
    obj = session.get(model, item_id)
    return obj.name if obj else None


def _compute_item_pricing(session: Session, item: OrderItemIn) -> tuple[float, float, list[OrderItemAddon]]:
    unit_price = (
        _catalog_price(session, CakeFlavor, item.cake_flavor_id)
        + _catalog_price(session, CakeFilling, item.cake_filling_id)
        + _catalog_price(session, CakeFrosting, item.cake_frosting_id)
        + _catalog_price(session, CakeShape, item.cake_shape_id)
        + _catalog_price(session, CakeSize, item.cake_size_id)
        + _catalog_price(session, CakeBox, item.cake_box_id)
        + _catalog_price(session, CakeTier, item.cake_tier_id)
        + _catalog_price(session, CakeColor, item.cake_color_id)
    )
    addon_rows: list[OrderItemAddon] = []
    addons_total = 0.0
    for a in item.addons:
        addon = session.get(CakeAddon, a.addon_id)
        if not addon:
            raise HTTPException(status_code=400, detail=f"Unknown add-on: {a.addon_id}")
        if a.quantity > addon.max_qty:
            raise HTTPException(status_code=400, detail=f"'{addon.name}' allows at most {addon.max_qty} per order")
        addons_total += addon.price * a.quantity
        addon_rows.append(OrderItemAddon(addon_id=addon.id, quantity=a.quantity, unit_price=addon.price))

    line_total = round_amount(session, unit_price * item.quantity + addons_total)
    return round_amount(session, unit_price), line_total, addon_rows


def _delivery_charge(session: Session, order: OrderIn) -> float:
    if order.fulfillment_type != FulfillmentType.DELIVERY or not order.delivery_zone_id:
        return 0
    zone = session.get(DeliveryZone, order.delivery_zone_id)
    return zone.price if zone else 0


def _resolve_customer(session: Session, payload: OrderIn) -> Customer:
    if payload.customer_id:
        customer = session.get(Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=400, detail="Unknown customer")
        return customer

    existing = session.exec(select(Customer).where(Customer.phone == payload.new_customer.phone)).first()
    if existing:
        return existing  # same phone already on file - reuse rather than duplicate
    customer = Customer(id=uuid.uuid4(), **payload.new_customer.model_dump())
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


def _item_to_out(session: Session, item: OrderItem) -> OrderItemOut:
    addon_rows = session.exec(select(OrderItemAddon).where(OrderItemAddon.order_item_id == item.id)).all()
    addons = []
    for row in addon_rows:
        addon = session.get(CakeAddon, row.addon_id)
        addons.append({"addon_id": str(row.addon_id), "name": addon.name if addon else None, "quantity": row.quantity, "unit_price": row.unit_price})

    return OrderItemOut(
        cake_flavor_id=item.cake_flavor_id, cake_flavor_name=_catalog_name(session, CakeFlavor, item.cake_flavor_id),
        cake_filling_id=item.cake_filling_id, cake_filling_name=_catalog_name(session, CakeFilling, item.cake_filling_id),
        cake_frosting_id=item.cake_frosting_id, cake_frosting_name=_catalog_name(session, CakeFrosting, item.cake_frosting_id),
        cake_shape_id=item.cake_shape_id, cake_shape_name=_catalog_name(session, CakeShape, item.cake_shape_id),
        cake_size_id=item.cake_size_id, cake_size_name=_catalog_name(session, CakeSize, item.cake_size_id),
        theme_id=item.theme_id, theme_name=_catalog_name(session, Theme, item.theme_id),
        cake_box_id=item.cake_box_id, cake_box_name=_catalog_name(session, CakeBox, item.cake_box_id),
        cake_tier_id=item.cake_tier_id, cake_tier_name=_catalog_name(session, CakeTier, item.cake_tier_id),
        cake_color_id=item.cake_color_id, cake_color_name=_catalog_name(session, CakeColor, item.cake_color_id),
        custom_message=item.custom_message, special_instructions=item.special_instructions,
        is_customer_design=item.is_customer_design, reference_image_url=item.reference_image_url,
        quantity=item.quantity, unit_price=item.unit_price, line_total=item.line_total, addons=addons,
    )


def _order_to_out(session: Session, order: Order) -> OrderOut:
    customer = session.get(Customer, order.customer_id)
    item = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()
    baker = session.get(Staff, order.baker_staff_id) if order.baker_staff_id else None
    rider = session.get(Staff, order.rider_staff_id) if order.rider_staff_id else None
    decliner = session.get(Staff, order.declined_by_staff_id) if order.declined_by_staff_id else None
    return OrderOut(
        id=order.id, order_number=order.order_number, customer_id=order.customer_id,
        customer_name=customer.full_name if customer else "—", customer_phone=customer.phone if customer else "",
        branch_id=order.branch_id, status=order.status, fulfillment_type=order.fulfillment_type,
        delivery_zone_id=order.delivery_zone_id, delivery_address=order.delivery_address,
        delivery_date=order.delivery_date, delivery_time=order.delivery_time,
        subtotal=order.subtotal, delivery_charge=order.delivery_charge, discount=order.discount,
        total=order.total, advance_paid=order.advance_paid, notes=order.notes,
        baker_staff_id=order.baker_staff_id, baker_name=baker.full_name if baker else None,
        baker_accepted_at=order.baker_accepted_at, decline_reason=order.decline_reason,
        declined_at=order.declined_at, declined_by_name=decliner.full_name if decliner else None,
        confirmed_at=order.confirmed_at, sent_to_baker_at=order.sent_to_baker_at,
        production_started_at=order.production_started_at, ready_at=order.ready_at,
        rider_staff_id=order.rider_staff_id, rider_name=rider.full_name if rider else None,
        assigned_rider_at=order.assigned_rider_at, delivery_started_at=order.delivery_started_at,
        delivered_at=order.delivered_at, rider_amount_collected=order.rider_amount_collected,
        amount_received=order.amount_received,
        handover_at=order.handover_at,
        created_at=order.created_at,
        business_date=order.business_date,
        item=_item_to_out(session, item) if item else None,
        latest_print=_latest_print(session, order.id),
    )


def _latest_print(session: Session, order_id: uuid.UUID) -> "PrintJobOut | None":
    job = session.exec(
        select(PrintJob).where(PrintJob.order_id == order_id).order_by(PrintJob.created_at.desc())
    ).first()
    return PrintJobOut(**job.model_dump()) if job else None


def _queue_roles(session: Session, staff_id: str) -> set[str] | None:
    """Which personal queues limit what this staff member sees.

    Returns None when they hold an admin/oversight role (they see every
    order). Otherwise returns the queue roles they hold - "Baker" means
    orders assigned to them to bake, "Delivery Boy" means orders assigned
    to them to deliver. Someone holding both sees the union."""
    role_names = set(
        session.exec(
            select(Role.name).join(StaffRole, StaffRole.role_id == Role.id).where(StaffRole.staff_id == staff_id)
        ).all()
    )
    if role_names & {"Super Admin", "Administrator", "Manager"}:
        return None
    queues = role_names & {"Baker", "Delivery Boy"}
    return queues or None


def _queue_filter(session: Session, staff_id: str):
    queues = _queue_roles(session, staff_id)
    if not queues:
        return None
    me = uuid.UUID(staff_id)
    conditions = []
    if "Baker" in queues:
        conditions.append(Order.baker_staff_id == me)
    if "Delivery Boy" in queues:
        conditions.append(Order.rider_staff_id == me)
    return or_(*conditions)


def _in_my_queue(session: Session, staff_id: str, order: Order) -> bool:
    queues = _queue_roles(session, staff_id)
    if not queues:
        return True
    return ("Baker" in queues and str(order.baker_staff_id) == staff_id) or (
        "Delivery Boy" in queues and str(order.rider_staff_id) == staff_id
    )


@router.get("", response_model=list[OrderListOut])
def list_orders(
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    query = select(Order)
    queue = _queue_filter(session, staff_id)
    if queue is not None:
        query = query.where(queue)

    orders = session.exec(query.order_by(Order.created_at.desc())).all()
    out = []
    for o in orders:
        customer = session.get(Customer, o.customer_id)
        baker = session.get(Staff, o.baker_staff_id) if o.baker_staff_id else None
        rider = session.get(Staff, o.rider_staff_id) if o.rider_staff_id else None
        out.append(OrderListOut(
            id=o.id, order_number=o.order_number, customer_name=customer.full_name if customer else "—",
            customer_phone=customer.phone if customer else "", status=o.status, fulfillment_type=o.fulfillment_type,
            delivery_date=o.delivery_date, total=o.total,
            baker_staff_id=o.baker_staff_id, baker_name=baker.full_name if baker else None,
            baker_accepted_at=o.baker_accepted_at, decline_reason=o.decline_reason,
            rider_staff_id=o.rider_staff_id, rider_name=rider.full_name if rider else None,
            created_at=o.created_at,
        ))
    return out


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not _in_my_queue(session, staff_id, order):
        raise HTTPException(status_code=403, detail="This order isn't assigned to you.")
    return _order_to_out(session, order)


@router.post("", response_model=OrderOut)
def create_order(
    payload: OrderIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.create")),
):
    customer = _resolve_customer(session, payload)
    unit_price, line_total, addon_rows = _compute_item_pricing(session, payload.item)
    delivery_charge = _delivery_charge(session, payload)
    subtotal = line_total
    total = round_amount(session, subtotal + delivery_charge - payload.discount)

    order = Order(
        id=uuid.uuid4(), order_number=generate_order_number(session), business_date=get_processing_date(session),
        customer_id=customer.id, branch_id=payload.branch_id, status=OrderStatus.DRAFT,
        fulfillment_type=payload.fulfillment_type, delivery_zone_id=payload.delivery_zone_id,
        delivery_address=payload.delivery_address, delivery_date=payload.delivery_date,
        delivery_time=payload.delivery_time, subtotal=subtotal, delivery_charge=delivery_charge,
        discount=payload.discount, total=total, advance_paid=payload.advance_paid, notes=payload.notes,
        created_by_staff_id=uuid.UUID(staff_id), created_at=datetime.now(timezone.utc),
    )
    session.add(order)
    session.commit()
    session.refresh(order)

    item = OrderItem(
        id=uuid.uuid4(), order_id=order.id,
        cake_flavor_id=payload.item.cake_flavor_id, cake_filling_id=payload.item.cake_filling_id,
        cake_frosting_id=payload.item.cake_frosting_id, cake_shape_id=payload.item.cake_shape_id,
        cake_size_id=payload.item.cake_size_id, theme_id=payload.item.theme_id, cake_box_id=payload.item.cake_box_id,
        cake_tier_id=payload.item.cake_tier_id,
        cake_color_id=payload.item.cake_color_id,
        custom_message=payload.item.custom_message, special_instructions=payload.item.special_instructions,
        is_customer_design=payload.item.is_customer_design,
        reference_image_url=payload.item.reference_image_url if payload.item.is_customer_design else None,
        quantity=payload.item.quantity, unit_price=unit_price, line_total=line_total,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    for addon_row in addon_rows:
        addon_row.order_item_id = item.id
        session.add(addon_row)
    session.commit()

    log_audit(session, "order.created", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order.id))
    return _order_to_out(session, order)


@router.put("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: uuid.UUID,
    payload: OrderIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.field.edit")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft orders can be edited")

    customer = _resolve_customer(session, payload)
    unit_price, line_total, addon_rows = _compute_item_pricing(session, payload.item)
    delivery_charge = _delivery_charge(session, payload)
    subtotal = line_total
    total = round_amount(session, subtotal + delivery_charge - payload.discount)

    order.customer_id = customer.id
    order.branch_id = payload.branch_id
    order.fulfillment_type = payload.fulfillment_type
    order.delivery_zone_id = payload.delivery_zone_id
    order.delivery_address = payload.delivery_address
    order.delivery_date = payload.delivery_date
    order.delivery_time = payload.delivery_time
    order.subtotal = subtotal
    order.delivery_charge = delivery_charge
    order.discount = payload.discount
    order.total = total
    order.advance_paid = payload.advance_paid
    order.notes = payload.notes
    session.add(order)

    existing_item = session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).first()
    carried_image_url = existing_item.reference_image_url if existing_item else None
    if existing_item:
        for old_addon in session.exec(select(OrderItemAddon).where(OrderItemAddon.order_item_id == existing_item.id)).all():
            session.delete(old_addon)
        session.delete(existing_item)
        session.commit()

    item = OrderItem(
        id=uuid.uuid4(), order_id=order.id,
        cake_flavor_id=payload.item.cake_flavor_id, cake_filling_id=payload.item.cake_filling_id,
        cake_frosting_id=payload.item.cake_frosting_id, cake_shape_id=payload.item.cake_shape_id,
        cake_size_id=payload.item.cake_size_id, theme_id=payload.item.theme_id, cake_box_id=payload.item.cake_box_id,
        cake_tier_id=payload.item.cake_tier_id,
        cake_color_id=payload.item.cake_color_id,
        custom_message=payload.item.custom_message, special_instructions=payload.item.special_instructions,
        is_customer_design=payload.item.is_customer_design,
        reference_image_url=(payload.item.reference_image_url or carried_image_url) if payload.item.is_customer_design else None,
        quantity=payload.item.quantity, unit_price=unit_price, line_total=line_total,
    )
    session.add(item)
    session.commit()
    session.refresh(item)

    for addon_row in addon_rows:
        addon_row.order_item_id = item.id
        session.add(addon_row)
    session.commit()

    log_audit(session, "order.updated", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order.id))
    return _order_to_out(session, order)


@router.put("/{order_id}/confirm", response_model=OrderOut)
def confirm_order(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.confirm")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft orders can be confirmed")
    order.status = OrderStatus.CONFIRMED
    order.confirmed_at = datetime.now(timezone.utc)
    order.confirmed_by_staff_id = uuid.UUID(staff_id)
    session.add(order)
    session.commit()
    log_audit(session, "order.confirmed", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    # Send the kitchen ticket. Never lets a printer problem undo the confirmation -
    # a failure is recorded on the order so staff can see it and reprint.
    try:
        _print_kitchen_ticket(session, order, staff_id, reason="confirmation")
    except Exception as exc:  # pragma: no cover - defensive
        session.rollback()
        session.add(PrintJob(order_id=order.id, reason="confirmation", mode="unknown", status="failed",
                             error=f"Unexpected error: {exc}", created_by_staff_id=uuid.UUID(staff_id)))
        session.commit()
    return _order_to_out(session, order)


class BakerOut(BaseModel):
    id: uuid.UUID
    full_name: str
    branch_id: uuid.UUID | None


@router.get("/staff/available-bakers", response_model=list[BakerOut])
def list_available_bakers(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.button.send_to_baker")),
):
    """Active staff holding the Baker role. Staff with no branch assigned
    can bake for any branch; staff with a home branch only show up here -
    the frontend can filter further by the order's branch if needed."""
    baker_role = session.exec(select(Role).where(Role.name == "Baker")).first()
    if not baker_role:
        return []
    staff_ids = session.exec(select(StaffRole.staff_id).where(StaffRole.role_id == baker_role.id)).all()
    if not staff_ids:
        return []
    bakers = session.exec(
        select(Staff).where(Staff.id.in_(staff_ids), Staff.is_active == True)  # noqa: E712
    ).all()
    return [BakerOut(id=b.id, full_name=b.full_name, branch_id=b.branch_id) for b in bakers]


class SendToBakerRequest(BaseModel):
    baker_staff_id: uuid.UUID


@router.put("/{order_id}/send-to-baker", response_model=OrderOut)
def send_order_to_baker(
    order_id: uuid.UUID,
    payload: SendToBakerRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.send_to_baker")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Only confirmed orders can be sent to the baker")

    baker = session.get(Staff, payload.baker_staff_id)
    if not baker or not baker.is_active:
        raise HTTPException(status_code=400, detail="Selected baker is not a valid active staff member")
    baker_role = session.exec(select(Role).where(Role.name == "Baker")).first()
    has_baker_role = baker_role and session.exec(
        select(StaffRole).where(StaffRole.staff_id == baker.id, StaffRole.role_id == baker_role.id)
    ).first()
    if not has_baker_role:
        raise HTTPException(status_code=400, detail=f"{baker.full_name} does not have the Baker role")

    order.status = OrderStatus.SENT_TO_BAKER
    order.sent_to_baker_at = datetime.now(timezone.utc)
    order.sent_to_baker_by_staff_id = uuid.UUID(staff_id)
    order.baker_staff_id = baker.id
    order.baker_accepted_at = None
    order.decline_reason = None
    order.declined_at = None
    order.declined_by_staff_id = None
    session.add(order)
    session.commit()
    log_audit(
        session, "order.sent_to_baker", actor_staff_id=uuid.UUID(staff_id), target_type="order",
        target_id=str(order_id), details={"baker_staff_id": str(baker.id), "baker_name": baker.full_name},
    )
    return _order_to_out(session, order)


def _get_assigned_pending_order(session: Session, order_id: uuid.UUID, staff_id: str) -> Order:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.SENT_TO_BAKER:
        raise HTTPException(status_code=400, detail="Only orders sent to a baker can be accepted or declined")
    if str(order.baker_staff_id) != staff_id:
        raise HTTPException(status_code=403, detail="Only the baker this order is assigned to can respond to it")
    if order.baker_accepted_at:
        raise HTTPException(status_code=400, detail="You have already accepted this order")
    return order


@router.put("/{order_id}/accept-baking", response_model=OrderOut)
def accept_baking(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.accept_baking")),
):
    order = _get_assigned_pending_order(session, order_id, staff_id)
    order.baker_accepted_at = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    log_audit(session, "order.baker_accepted", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    return _order_to_out(session, order)


class DeclineBakingRequest(BaseModel):
    reason: str


@router.put("/{order_id}/decline-baking", response_model=OrderOut)
def decline_baking(
    order_id: uuid.UUID,
    payload: DeclineBakingRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.accept_baking")),
):
    """Baker turns down the assignment. The order returns to CONFIRMED with
    no baker, so a manager can send it to someone else; the reason is kept
    on the order until it's reassigned (and permanently in the audit log)."""
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Please give a reason for declining")
    order = _get_assigned_pending_order(session, order_id, staff_id)

    declined_baker_id = order.baker_staff_id
    order.status = OrderStatus.CONFIRMED
    order.baker_staff_id = None
    order.sent_to_baker_at = None
    order.decline_reason = reason
    order.declined_at = datetime.now(timezone.utc)
    order.declined_by_staff_id = declined_baker_id
    session.add(order)
    session.commit()
    log_audit(
        session, "order.baker_declined", actor_staff_id=uuid.UUID(staff_id), target_type="order",
        target_id=str(order_id), details={"reason": reason},
    )
    return _order_to_out(session, order)


class IngredientUsageIn(BaseModel):
    inventory_item_id: uuid.UUID
    quantity_used: float
    unit_id: uuid.UUID | None = None  # unit the quantity was entered in; defaults to the ingredient's own


class StartBakingRequest(BaseModel):
    ingredients: list[IngredientUsageIn] = []


class IngredientUsageOut(BaseModel):
    inventory_item_id: uuid.UUID
    inventory_item_name: str
    quantity_used: float
    unit: str
    entered_quantity: float | None
    entered_unit: str | None
    recorded_by: str | None = None
    recorded_at: datetime | None = None
    processing_date: date | None = None
    cost: float | None = None          # only for people who can see profit; None = unknown price


@router.put("/{order_id}/start-baking", response_model=OrderOut)
def start_baking(
    order_id: uuid.UUID,
    payload: StartBakingRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.start_baking")),
):
    """Baker records what ingredients (and how much) went into this order.
    Each entry deducts the same quantity from that item's stock on hand -
    negative stock is allowed rather than blocked, since the priority is
    an accurate usage record even if inventory counts drift over time."""
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.SENT_TO_BAKER:
        raise HTTPException(status_code=400, detail="Only orders sent to a baker can start production")
    if str(order.baker_staff_id) != staff_id:
        raise HTTPException(status_code=403, detail="Only the baker this order is assigned to can start baking it")
    if not order.baker_accepted_at:
        raise HTTPException(status_code=400, detail="Accept the order before starting to bake it")

    processing_date = get_processing_date(session)
    for entry in payload.ingredients:
        item = session.get(InventoryItem, entry.inventory_item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Unknown inventory item: {entry.inventory_item_id}")
        if entry.quantity_used <= 0:
            raise HTTPException(status_code=400, detail="Ingredient quantity must be greater than zero")

        # Convert what the baker entered (e.g. 500 g) into the ingredient's own
        # stock unit (e.g. 0.5 kg) before deducting.
        options = unit_options(session, item)
        chosen = options[0] if entry.unit_id is None else next((o for o in options if o[0] == entry.unit_id), None)
        if chosen is None:
            raise HTTPException(
                status_code=400,
                detail=f"That unit can't be used for {item.name} (stocked in {options[0][1] or 'its own unit'})",
            )
        _, entered_abbr, to_item_unit = chosen
        qty_in_stock_unit = round(entry.quantity_used * to_item_unit, 6)

        session.add(OrderIngredientUsage(
            order_id=order_id, inventory_item_id=item.id, quantity_used=qty_in_stock_unit,
            entered_quantity=entry.quantity_used, entered_unit=entered_abbr,
            processing_date=processing_date, recorded_by_staff_id=uuid.UUID(staff_id),
        ))
        item.qty_on_hand = round(item.qty_on_hand - qty_in_stock_unit, 6)
        session.add(item)
        session.add(StockMovement(
            inventory_item_id=item.id, qty_delta=-qty_in_stock_unit, reason="production_use",
            processing_date=processing_date, created_by_staff_id=uuid.UUID(staff_id),
        ))

    order.status = OrderStatus.IN_PRODUCTION
    order.production_started_at = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    log_audit(session, "order.production_started", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    return _order_to_out(session, order)


@router.get("/{order_id}/ingredient-usage", response_model=list[IngredientUsageOut])
def get_ingredient_usage(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    """What went into this cake: each ingredient, how much, who logged it and when.
    Cost is included only for staff who can see profit."""
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not _in_my_queue(session, staff_id, order):
        raise HTTPException(status_code=403, detail="This order isn't in your queue")
    from app.services.permission_service import get_effective_permissions
    from app.api.v1.endpoints.reports import _avg_costs
    show_cost = "reports.profit.view" in get_effective_permissions(session, uuid.UUID(staff_id))
    costs = _avg_costs(session) if show_cost else {}
    rows = session.exec(
        select(OrderIngredientUsage).where(OrderIngredientUsage.order_id == order_id).order_by(OrderIngredientUsage.recorded_at)
    ).all()
    names = {st.id: st.full_name for st in session.exec(select(Staff).where(Staff.id.in_({r.recorded_by_staff_id for r in rows}))).all()} if rows else {}
    out = []
    for row in rows:
        item = session.get(InventoryItem, row.inventory_item_id)
        out.append(IngredientUsageOut(
            inventory_item_id=row.inventory_item_id,
            inventory_item_name=item.name if item else "Unknown item",
            quantity_used=row.quantity_used,
            unit=unit_label(session, item) if item else "",
            entered_quantity=row.entered_quantity, entered_unit=row.entered_unit,
            recorded_by=names.get(row.recorded_by_staff_id), recorded_at=row.recorded_at,
            processing_date=row.processing_date,
            cost=(row.quantity_used * costs[row.inventory_item_id]) if show_cost and row.inventory_item_id in costs else None,
        ))
    return out


@router.put("/{order_id}/mark-ready", response_model=OrderOut)
def mark_ready(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.mark_ready")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.IN_PRODUCTION:
        raise HTTPException(status_code=400, detail="Only orders currently in production can be marked ready")
    if str(order.baker_staff_id) != staff_id:
        raise HTTPException(status_code=403, detail="Only the baker this order is assigned to can mark it ready")

    order.status = OrderStatus.READY
    order.ready_at = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    log_audit(session, "order.marked_ready", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    return _order_to_out(session, order)


class RiderOut(BaseModel):
    id: uuid.UUID
    full_name: str
    branch_id: uuid.UUID | None


@router.get("/staff/available-riders", response_model=list[RiderOut])
def list_available_riders(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.button.assign_rider")),
):
    """Active staff holding the Delivery Boy role."""
    rider_role = session.exec(select(Role).where(Role.name == "Delivery Boy")).first()
    if not rider_role:
        return []
    staff_ids = session.exec(select(StaffRole.staff_id).where(StaffRole.role_id == rider_role.id)).all()
    if not staff_ids:
        return []
    riders = session.exec(
        select(Staff).where(Staff.id.in_(staff_ids), Staff.is_active == True)  # noqa: E712
    ).all()
    return [RiderOut(id=r.id, full_name=r.full_name, branch_id=r.branch_id) for r in riders]


class AssignRiderRequest(BaseModel):
    rider_staff_id: uuid.UUID


@router.put("/{order_id}/assign-rider", response_model=OrderOut)
def assign_rider(
    order_id: uuid.UUID,
    payload: AssignRiderRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.assign_rider")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.READY, OrderStatus.RIDER_ASSIGNED):
        raise HTTPException(
            status_code=400,
            detail="A rider can only be assigned (or changed) before the delivery has started",
        )
    if order.fulfillment_type != FulfillmentType.DELIVERY:
        raise HTTPException(status_code=400, detail="This order is for pickup, not delivery")

    rider = session.get(Staff, payload.rider_staff_id)
    if not rider or not rider.is_active:
        raise HTTPException(status_code=400, detail="Selected rider is not a valid active staff member")
    rider_role = session.exec(select(Role).where(Role.name == "Delivery Boy")).first()
    has_role = rider_role and session.exec(
        select(StaffRole).where(StaffRole.staff_id == rider.id, StaffRole.role_id == rider_role.id)
    ).first()
    if not has_role:
        raise HTTPException(status_code=400, detail=f"{rider.full_name} does not have the Delivery Boy role")

    order.rider_staff_id = rider.id
    order.assigned_rider_at = datetime.now(timezone.utc)
    order.status = OrderStatus.RIDER_ASSIGNED
    session.add(order)
    session.commit()
    log_audit(
        session, "order.rider_assigned", actor_staff_id=uuid.UUID(staff_id), target_type="order",
        target_id=str(order_id), details={"rider_staff_id": str(rider.id), "rider_name": rider.full_name},
    )
    return _order_to_out(session, order)


def _get_my_delivery(session: Session, order_id: uuid.UUID, staff_id: str, expected: OrderStatus, action: str) -> Order:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.rider_staff_id) != staff_id:
        raise HTTPException(status_code=403, detail=f"Only the rider assigned to this order can {action}")
    if order.status != expected:
        raise HTTPException(status_code=400, detail=f"This order can't {action} right now")
    return order


@router.put("/{order_id}/start-delivery", response_model=OrderOut)
def start_delivery(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.start_delivery")),
):
    order = _get_my_delivery(session, order_id, staff_id, OrderStatus.RIDER_ASSIGNED, "start delivery")
    order.status = OrderStatus.OUT_FOR_DELIVERY
    order.delivery_started_at = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    log_audit(session, "order.delivery_started", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    return _order_to_out(session, order)


class MarkDeliveredRequest(BaseModel):
    amount_collected: float


@router.put("/{order_id}/mark-delivered", response_model=OrderOut)
def mark_delivered(
    order_id: uuid.UUID,
    payload: MarkDeliveredRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.mark_delivered")),
):
    """Rider has handed the cake over and records what the customer paid.
    The order stays open (DELIVERED) until a manager confirms they've
    received that cash from the rider."""
    if payload.amount_collected < 0:
        raise HTTPException(status_code=400, detail="Amount collected can't be negative")
    order = _get_my_delivery(session, order_id, staff_id, OrderStatus.OUT_FOR_DELIVERY, "mark it delivered")
    order.status = OrderStatus.DELIVERED
    order.delivered_at = datetime.now(timezone.utc)
    order.rider_amount_collected = round_amount(session, payload.amount_collected)
    session.add(order)
    session.commit()
    log_audit(
        session, "order.delivered", actor_staff_id=uuid.UUID(staff_id), target_type="order",
        target_id=str(order_id), details={"amount_collected": payload.amount_collected},
    )
    return _order_to_out(session, order)


class HandoverRequest(BaseModel):
    amount_received: float


@router.put("/{order_id}/handover", response_model=OrderOut)
def handover_order(
    order_id: uuid.UUID,
    payload: HandoverRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.handover")),
):
    """Completes the order - customer picked up (straight from READY) or
    the manager has received the rider's cash (from DELIVERED) - and
    records the amount actually received."""
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    valid_from = OrderStatus.READY if order.fulfillment_type == FulfillmentType.PICKUP else OrderStatus.DELIVERED
    if order.status != valid_from:
        detail = (
            "This order isn't ready for pickup yet"
            if order.fulfillment_type == FulfillmentType.PICKUP
            else "The rider hasn't marked this order delivered yet"
        )
        raise HTTPException(status_code=400, detail=detail)
    if payload.amount_received < 0:
        raise HTTPException(status_code=400, detail="Amount received can't be negative")

    order.amount_received = round_amount(session, payload.amount_received)
    order.handover_at = datetime.now(timezone.utc)
    order.handover_by_staff_id = uuid.UUID(staff_id)
    order.status = OrderStatus.COMPLETED
    session.add(order)
    session.commit()
    log_audit(
        session, "order.handover_completed", actor_staff_id=uuid.UUID(staff_id), target_type="order",
        target_id=str(order_id), details={"amount_received": payload.amount_received},
    )
    return _order_to_out(session, order)


@router.put("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.cancel")),
):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in (OrderStatus.COMPLETED, OrderStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="This order can't be cancelled")
    order.status = OrderStatus.CANCELLED
    session.add(order)
    session.commit()
    log_audit(session, "order.cancelled", actor_staff_id=uuid.UUID(staff_id), target_type="order", target_id=str(order_id))
    return _order_to_out(session, order)


# ---------------------------------------------------------------- receipts & printing

def _order_for_viewer(session: Session, order_id: uuid.UUID, staff_id: str) -> Order:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not _in_my_queue(session, staff_id, order):
        raise HTTPException(status_code=403, detail="This order isn't in your queue")
    return order


def _print_kitchen_ticket(session: Session, order: Order, staff_id: str, reason: str) -> PrintJob | None:
    cfg = printer_settings(session)
    mode = cfg.printer_mode or "browser"
    if mode == "off":
        if reason == "confirmation":
            return None
        mode = "browser"  # a manual reprint with printing off still opens the print dialog
    receipt = build_receipt(session, _order_to_out(session, order))
    job = PrintJob(order_id=order.id, reason=reason, mode=mode, status="browser",
                   created_by_staff_id=uuid.UUID(staff_id))
    if mode == "network":
        job.printer = f"{cfg.printer_host}:{cfg.printer_port}" if cfg.printer_host else None
        if not cfg.printer_host:
            job.status, job.error = "failed", "No printer address is set in System setup"
        else:
            try:
                send_to_network_printer(cfg.printer_host, cfg.printer_port, escpos_bytes(receipt, cfg.printer_width))
                job.status = "sent"
            except OSError as exc:
                job.status = "failed"
                job.error = f"Couldn't reach the printer at {job.printer}: {exc.strerror or exc}"
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


class ReceiptOut(BaseModel):
    receipt: dict
    ticket_lines: list[list[str]]
    ticket_width: int
    whatsapp_phone: str | None
    share_text: str
    printer_mode: str


def _whatsapp_number(phone: str, country_code: str) -> str | None:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return None
    if phone.strip().startswith("+") or digits.startswith(country_code):
        return digits
    if digits.startswith("0"):
        return country_code + digits[1:]
    return country_code + digits


@router.get("/{order_id}/receipt", response_model=ReceiptOut)
def get_receipt(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    """Receipt data for the on-screen preview, sharing, and browser-printed kitchen tickets."""
    order = _order_for_viewer(session, order_id, staff_id)
    cfg = printer_settings(session)
    r = build_receipt(session, _order_to_out(session, order))
    if r.kind == "payment":
        share_text = (
            f"{r.company} - payment receipt for order {r.order_number}\n"
            f"Hello {r.customer_name}, thank you! {r.status_text}.\n"
            f"Total: {r.currency} {r.total}, advance: {r.currency} {r.advance_paid}, "
            f"{r.payment_label.lower()}: {r.currency} {r.payment_amount}"
        )
    elif r.kind == "delivery":
        share_text = (
            f"{r.company} - order {r.order_number} is on its way\n"
            f"Hello {r.customer_name}, your cake is being delivered to {r.delivery_address or 'you'}.\n"
            f"{r.status_text}"
        )
    else:
        status_line = "Please reply to confirm your order." if r.is_draft else "Your order is confirmed."
        share_text = (
            f"{r.company} - order {r.order_number}\n"
            f"Hello {r.customer_name}, here is your order summary.\n"
            f"Due: {r.due} ({r.fulfillment})\n"
            f"Total: {r.currency} {r.total}, advance paid: {r.currency} {r.advance_paid}, balance: {r.currency} {r.balance_due}\n"
            f"{status_line}"
        )
    return ReceiptOut(
        receipt=asdict(r) | {"lines": [asdict(ln) for ln in r.lines], "logo_path": None, "reference_image_path": None},
        ticket_lines=[[style, text] for style, text in ticket_lines(r, cfg.printer_width)],
        ticket_width=cfg.printer_width,
        whatsapp_phone=_whatsapp_number(r.customer_phone, cfg.phone_country_code or "92"),
        share_text=share_text,
        printer_mode=cfg.printer_mode or "browser",
    )


class KitchenTicketOut(BaseModel):
    order_number: str
    ticket_lines: list[list[str]]
    ticket_width: int
    reference_image_url: str | None


@router.get("/{order_id}/kitchen-ticket", response_model=KitchenTicketOut)
def get_kitchen_ticket(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    """What the kitchen needs to bake - no prices. Available to the baker it's sent to."""
    order = _order_for_viewer(session, order_id, staff_id)
    if order.status == OrderStatus.DRAFT:
        raise HTTPException(status_code=400, detail="The kitchen ticket is available once the order is confirmed")
    out = _order_to_out(session, order)
    cfg = printer_settings(session)
    r = build_receipt(session, out)
    return KitchenTicketOut(
        order_number=order.order_number,
        ticket_lines=[[st, tx] for st, tx in ticket_lines(r, cfg.printer_width)],
        ticket_width=cfg.printer_width,
        reference_image_url=out.item.reference_image_url if out.item and out.item.is_customer_design else None,
    )


@router.get("/{order_id}/kitchen-ticket.pdf")
def get_kitchen_ticket_pdf(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    order = _order_for_viewer(session, order_id, staff_id)
    if order.status == OrderStatus.DRAFT:
        raise HTTPException(status_code=400, detail="The kitchen ticket is available once the order is confirmed")
    cfg = printer_settings(session)
    pdf = render_ticket_pdf(build_receipt(session, _order_to_out(session, order)), cfg.printer_width)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="kitchen-ticket-{order.order_number}.pdf"'})


@router.get("/{order_id}/receipt.pdf")
def get_receipt_pdf(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    order = _order_for_viewer(session, order_id, staff_id)
    pdf = render_pdf(build_receipt(session, _order_to_out(session, order)))
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receipt-{order.order_number}.pdf"'},
    )


@router.post("/{order_id}/print", response_model=PrintJobOut)
def print_ticket(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.button.print")),
):
    """Reprint the kitchen ticket (e.g. after fixing a printer)."""
    order = _order_for_viewer(session, order_id, staff_id)
    if order.status == OrderStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Confirm the order before printing a kitchen ticket")
    job = _print_kitchen_ticket(session, order, staff_id, reason="reprint")
    return PrintJobOut(**job.model_dump())


@router.get("/{order_id}/print-jobs", response_model=list[PrintJobOut])
def list_print_jobs(
    order_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("orders.page.view")),
):
    _order_for_viewer(session, order_id, staff_id)
    jobs = session.exec(select(PrintJob).where(PrintJob.order_id == order_id).order_by(PrintJob.created_at.desc())).all()
    return [PrintJobOut(**j.model_dump()) for j in jobs]
