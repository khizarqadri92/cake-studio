import uuid
from datetime import date, datetime, timezone
from pydantic import BaseModel, field_validator

from app.services.units import ensure_standard_units, guess_unit
from app.services.number_format import round_amount
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
from app.services.processing_date import get_processing_date
from app.services.audit import log_audit
from app.models.inventory import InventoryItem, Supplier, StockMovement, UnitOfMeasure, Purchase, PurchaseItem
from app.models.staff import Staff

router = APIRouter()


# --- units of measure ---

MEASURES = ("weight", "volume", "count")


class UnitOut(BaseModel):
    id: uuid.UUID
    name: str
    abbreviation: str
    measure: str | None
    factor: float
    is_active: bool
    sort_order: int


class UnitIn(BaseModel):
    name: str
    abbreviation: str
    measure: str | None = None
    factor: float = 1.0
    is_active: bool = True
    sort_order: int = 0

    @field_validator("measure")
    @classmethod
    def _measure_known(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if v not in MEASURES:
            raise ValueError(f"measure must be one of {', '.join(MEASURES)}")
        return v

    @field_validator("factor")
    @classmethod
    def _factor_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("size must be greater than zero")
        return v


@router.get("/units", response_model=list[UnitOut])
def list_units(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    return session.exec(select(UnitOfMeasure).order_by(UnitOfMeasure.sort_order, UnitOfMeasure.name)).all()


@router.post("/units", response_model=UnitOut)
def create_unit(
    payload: UnitIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.create")),
):
    if session.exec(select(UnitOfMeasure).where(UnitOfMeasure.name == payload.name)).first():
        raise HTTPException(status_code=400, detail="A unit with this name already exists")
    data = payload.model_dump()
    # "Measures" left unset on a recognisable unit (kg, ml, dozen...) -> fill it in,
    # so it converts with its siblings without extra setup.
    if not data.get("measure"):
        guessed = guess_unit(data["name"], data["abbreviation"])
        if guessed:
            data["measure"], data["factor"] = guessed
    unit = UnitOfMeasure(id=uuid.uuid4(), **data)
    session.add(unit)
    session.commit()
    ensure_standard_units(session)  # e.g. adding "kg" also adds "g"
    session.refresh(unit)
    log_audit(session, "unit.created", actor_staff_id=uuid.UUID(staff_id), target_type="unit", target_id=str(unit.id))
    return unit


@router.put("/units/{unit_id}", response_model=UnitOut)
def update_unit(
    unit_id: uuid.UUID,
    payload: UnitIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.field.edit")),
):
    unit = session.get(UnitOfMeasure, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    for key, value in payload.model_dump().items():
        setattr(unit, key, value)
    session.add(unit)
    session.commit()
    ensure_standard_units(session)
    session.refresh(unit)
    log_audit(session, "unit.updated", actor_staff_id=uuid.UUID(staff_id), target_type="unit", target_id=str(unit_id))
    return unit


@router.delete("/units/{unit_id}")
def delete_unit(
    unit_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.delete")),
):
    unit = session.get(UnitOfMeasure, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    in_use = session.exec(select(InventoryItem).where(InventoryItem.unit_id == unit_id)).first()
    if in_use:
        raise HTTPException(status_code=400, detail="This unit is used by one or more inventory items. Reassign them first.")
    session.delete(unit)
    session.commit()
    log_audit(session, "unit.deleted", actor_staff_id=uuid.UUID(staff_id), target_type="unit", target_id=str(unit_id))
    return {"status": "ok"}


# --- suppliers ---

class SupplierOut(BaseModel):
    id: uuid.UUID
    name: str
    contact_phone: str | None


class SupplierIn(BaseModel):
    name: str
    contact_phone: str | None = None


@router.get("/suppliers", response_model=list[SupplierOut])
def list_suppliers(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    return session.exec(select(Supplier).order_by(Supplier.name)).all()


@router.post("/suppliers", response_model=SupplierOut)
def create_supplier(
    payload: SupplierIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.create")),
):
    supplier = Supplier(id=uuid.uuid4(), **payload.model_dump())
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    log_audit(session, "supplier.created", actor_staff_id=uuid.UUID(staff_id), target_type="supplier", target_id=str(supplier.id))
    return supplier


@router.put("/suppliers/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: uuid.UUID,
    payload: SupplierIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.field.edit")),
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for key, value in payload.model_dump().items():
        setattr(supplier, key, value)
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    log_audit(session, "supplier.updated", actor_staff_id=uuid.UUID(staff_id), target_type="supplier", target_id=str(supplier_id))
    return supplier


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.delete")),
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    in_use = session.exec(select(InventoryItem).where(InventoryItem.supplier_id == supplier_id)).first()
    if in_use:
        raise HTTPException(status_code=400, detail="This supplier is linked to one or more inventory items. Reassign them first.")
    session.delete(supplier)
    session.commit()
    log_audit(session, "supplier.deleted", actor_staff_id=uuid.UUID(staff_id), target_type="supplier", target_id=str(supplier_id))
    return {"status": "ok"}


# --- inventory items ---

class UnitOption(BaseModel):
    unit_id: uuid.UUID | None
    abbreviation: str
    to_item_unit: float  # 1 of this unit = this many of the ingredient's own unit


class InventoryItemOut(BaseModel):
    id: uuid.UUID
    name: str
    unit_id: uuid.UUID | None
    unit_name: str | None
    qty_on_hand: float
    reorder_threshold: float
    supplier_id: uuid.UUID | None
    supplier_name: str | None
    is_active: bool
    is_low_stock: bool
    unit_options: list[UnitOption]


class InventoryItemCreate(BaseModel):
    name: str
    unit_id: uuid.UUID | None = None
    qty_on_hand: float = 0  # starting stock, only settable at creation
    reorder_threshold: float = 0
    supplier_id: uuid.UUID | None = None


class InventoryItemUpdate(BaseModel):
    """Deliberately excludes qty_on_hand - stock only changes through
    purchases/adjustments/production use, so there's always a StockMovement
    record explaining why the number moved."""

    name: str
    unit_id: uuid.UUID | None = None
    reorder_threshold: float
    supplier_id: uuid.UUID | None = None
    is_active: bool = True


def unit_options(session: Session, item: InventoryItem) -> list[tuple[uuid.UUID | None, str, float]]:
    """Units a quantity of this ingredient can be entered in, as
    (unit_id, abbreviation, multiplier-to-the-ingredient's-own-unit).
    The ingredient's own unit always comes first with multiplier 1."""
    own = session.get(UnitOfMeasure, item.unit_id) if item.unit_id else None
    if not own:
        return [(None, item.unit or "", 1.0)]
    options = [(own.id, own.abbreviation, 1.0)]
    if own.measure:
        siblings = session.exec(
            select(UnitOfMeasure).where(
                UnitOfMeasure.measure == own.measure,
                UnitOfMeasure.is_active == True,  # noqa: E712
                UnitOfMeasure.id != own.id,
            ).order_by(UnitOfMeasure.factor)
        ).all()
        options += [(u.id, u.abbreviation, u.factor / own.factor) for u in siblings]
    return options


def unit_label(session: Session, item: InventoryItem) -> str:
    """Display unit for an item: the configured unit's abbreviation, falling
    back to the old free-text unit on rows created before the Units setup."""
    unit = session.get(UnitOfMeasure, item.unit_id) if item.unit_id else None
    return (unit.abbreviation if unit else None) or item.unit or ""


def _item_to_out(session: Session, item: InventoryItem) -> InventoryItemOut:
    supplier = session.get(Supplier, item.supplier_id) if item.supplier_id else None
    unit = session.get(UnitOfMeasure, item.unit_id) if item.unit_id else None
    return InventoryItemOut(
        id=item.id, name=item.name, unit_id=item.unit_id,
        unit_name=(unit.abbreviation if unit else None) or item.unit,
        qty_on_hand=item.qty_on_hand, reorder_threshold=item.reorder_threshold,
        supplier_id=item.supplier_id, supplier_name=supplier.name if supplier else None,
        is_active=item.is_active, is_low_stock=item.qty_on_hand <= item.reorder_threshold,
        unit_options=[UnitOption(unit_id=u, abbreviation=a, to_item_unit=f) for u, a, f in unit_options(session, item)],
    )


class BakingIngredientOut(BaseModel):
    id: uuid.UUID
    name: str
    unit: str
    unit_options: list[UnitOption]
    qty_on_hand: float
    reorder_threshold: float


@router.get("/items/for-baking", response_model=list[BakingIngredientOut])
def list_ingredients_for_baking(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.button.start_baking")),
):
    """Active ingredients for the baker's Start baking picker. Gated by the
    start-baking permission rather than inventory access, so a baker can log
    usage without being given the inventory management screens."""
    items = session.exec(
        select(InventoryItem).where(InventoryItem.is_active == True).order_by(InventoryItem.name)  # noqa: E712
    ).all()
    return [
        BakingIngredientOut(
            id=i.id, name=i.name, unit=unit_label(session, i),
            unit_options=[UnitOption(unit_id=u, abbreviation=a, to_item_unit=f) for u, a, f in unit_options(session, i)],
            qty_on_hand=i.qty_on_hand, reorder_threshold=i.reorder_threshold,
        )
        for i in items
    ]


@router.get("/items", response_model=list[InventoryItemOut])
def list_inventory_items(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    """Also powers the baker's ingredient-usage picker when starting production."""
    items = session.exec(select(InventoryItem).order_by(InventoryItem.name)).all()
    return [_item_to_out(session, i) for i in items]


@router.post("/items", response_model=InventoryItemOut)
def create_inventory_item(
    payload: InventoryItemCreate,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.create")),
):
    if session.exec(select(InventoryItem).where(InventoryItem.name == payload.name)).first():
        raise HTTPException(status_code=400, detail="An item with this name already exists")
    if payload.supplier_id and not session.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=400, detail="Unknown supplier")
    if payload.unit_id and not session.get(UnitOfMeasure, payload.unit_id):
        raise HTTPException(status_code=400, detail="Unknown unit")

    item = InventoryItem(id=uuid.uuid4(), **payload.model_dump())
    session.add(item)
    session.commit()
    session.refresh(item)

    if payload.qty_on_hand:
        session.add(StockMovement(
            inventory_item_id=item.id, qty_delta=payload.qty_on_hand, reason="initial_stock",
            processing_date=get_processing_date(session), created_by_staff_id=uuid.UUID(staff_id),
        ))
        session.commit()

    log_audit(session, "inventory_item.created", actor_staff_id=uuid.UUID(staff_id), target_type="inventory_item", target_id=str(item.id))
    return _item_to_out(session, item)


@router.put("/items/{item_id}", response_model=InventoryItemOut)
def update_inventory_item(
    item_id: uuid.UUID,
    payload: InventoryItemUpdate,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.field.edit")),
):
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.supplier_id and not session.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=400, detail="Unknown supplier")
    if payload.unit_id and not session.get(UnitOfMeasure, payload.unit_id):
        raise HTTPException(status_code=400, detail="Unknown unit")

    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    log_audit(session, "inventory_item.updated", actor_staff_id=uuid.UUID(staff_id), target_type="inventory_item", target_id=str(item_id))
    return _item_to_out(session, item)


@router.delete("/items/{item_id}")
def delete_inventory_item(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.delete")),
):
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    has_history = session.exec(select(StockMovement).where(StockMovement.inventory_item_id == item_id)).first()
    if has_history:
        raise HTTPException(
            status_code=400,
            detail="This item has stock movement history and can't be deleted. Mark it inactive instead.",
        )
    session.delete(item)
    session.commit()
    log_audit(session, "inventory_item.deleted", actor_staff_id=uuid.UUID(staff_id), target_type="inventory_item", target_id=str(item_id))
    return {"status": "ok"}


# --- purchases (multi-item, with pricing) ---

class PurchaseLineIn(BaseModel):
    inventory_item_id: uuid.UUID
    quantity: float
    unit_price: float  # per the unit the quantity is entered in
    unit_id: uuid.UUID | None = None  # defaults to the ingredient's own stock unit


class PurchaseIn(BaseModel):
    supplier_id: uuid.UUID | None = None
    invoice_number: str | None = None
    purchase_date: date | None = None  # defaults to the current processing date
    notes: str | None = None
    items: list[PurchaseLineIn]


class PurchaseLineOut(BaseModel):
    inventory_item_id: uuid.UUID
    inventory_item_name: str
    quantity: float        # in the ingredient's stock unit
    unit: str              # the ingredient's stock unit
    unit_price: float      # per stock unit
    line_total: float
    entered_quantity: float | None
    entered_unit: str | None
    entered_unit_price: float | None


class PurchaseOut(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID | None
    supplier_name: str | None
    invoice_number: str | None
    purchase_date: date
    notes: str | None
    total_amount: float
    created_by_name: str | None
    created_at: datetime
    items: list[PurchaseLineOut]


def _check_purchase_lines(session: Session, payload: "PurchaseIn"):
    """Validates a purchase's lines and resolves each line's unit. Used by both
    recording and editing, so both follow exactly the same rules."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one item to the purchase")
    if payload.supplier_id and not session.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=400, detail="Unknown supplier")
    items_with_records = []
    for line in payload.items:
        item = session.get(InventoryItem, line.inventory_item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Unknown inventory item: {line.inventory_item_id}")
        if line.quantity <= 0 or line.unit_price < 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive and price can't be negative")
        options = unit_options(session, item)
        chosen = options[0] if line.unit_id is None else next((o for o in options if o[0] == line.unit_id), None)
        if chosen is None:
            raise HTTPException(
                status_code=400,
                detail=f"That unit can't be used for {item.name} (stocked in {options[0][1] or 'its own unit'})",
            )
        items_with_records.append((line, item, chosen))
    return items_with_records


def _purchase_out(session: Session, purchase: "Purchase") -> "PurchaseOut":
    lines = session.exec(select(PurchaseItem).where(PurchaseItem.purchase_id == purchase.id)).all()
    supplier = session.get(Supplier, purchase.supplier_id) if purchase.supplier_id else None
    staff = session.get(Staff, purchase.created_by_staff_id)
    line_outs = []
    for line in lines:
        item = session.get(InventoryItem, line.inventory_item_id)
        line_outs.append(PurchaseLineOut(
            inventory_item_id=line.inventory_item_id, inventory_item_name=item.name if item else "Unknown item",
            quantity=line.quantity, unit=unit_label(session, item) if item else "",
            unit_price=line.unit_price, line_total=line.line_total,
            entered_quantity=line.entered_quantity, entered_unit=line.entered_unit,
            entered_unit_price=line.entered_unit_price,
        ))
    return PurchaseOut(
        id=purchase.id, supplier_id=purchase.supplier_id, supplier_name=supplier.name if supplier else None,
        invoice_number=purchase.invoice_number, purchase_date=purchase.purchase_date, notes=purchase.notes,
        total_amount=purchase.total_amount, created_by_name=staff.full_name if staff else None,
        created_at=purchase.created_at, items=line_outs,
    )


@router.post("/purchases", response_model=PurchaseOut)
def create_purchase(
    payload: PurchaseIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.adjust_stock")),
):
    items_with_records = _check_purchase_lines(session, payload)

    processing_date = payload.purchase_date or get_processing_date(session)
    purchase = Purchase(
        id=uuid.uuid4(), supplier_id=payload.supplier_id, invoice_number=payload.invoice_number,
        purchase_date=processing_date, notes=payload.notes,
        total_amount=round_amount(session, sum(round_amount(session, line.quantity * line.unit_price) for line, _, _ in items_with_records)),
        created_by_staff_id=uuid.UUID(staff_id),
    )
    session.add(purchase)
    session.commit()
    session.refresh(purchase)

    line_outs = []
    for line, item, (_, entered_abbr, to_item_unit) in items_with_records:
        # Price is per the unit typed (e.g. per g); line total is simply qty x price.
        # Stock and stored price are converted to the ingredient's own unit (e.g. kg).
        line_total = round_amount(session, line.quantity * line.unit_price)
        stock_qty = round(line.quantity * to_item_unit, 6)
        stock_unit_price = round(line.unit_price / to_item_unit, 6)
        session.add(PurchaseItem(
            id=uuid.uuid4(), purchase_id=purchase.id, inventory_item_id=item.id,
            quantity=stock_qty, unit_price=stock_unit_price, line_total=line_total,
            entered_quantity=line.quantity, entered_unit=entered_abbr, entered_unit_price=line.unit_price,
        ))
        session.add(StockMovement(
            inventory_item_id=item.id, qty_delta=stock_qty, reason="purchase",
            unit_price=stock_unit_price, purchase_id=purchase.id,
            processing_date=processing_date, created_by_staff_id=uuid.UUID(staff_id),
        ))
        item.qty_on_hand = round(item.qty_on_hand + stock_qty, 6)
        session.add(item)
        line_outs.append(PurchaseLineOut(
            inventory_item_id=item.id, inventory_item_name=item.name,
            quantity=stock_qty, unit=unit_label(session, item), unit_price=stock_unit_price, line_total=line_total,
            entered_quantity=line.quantity, entered_unit=entered_abbr, entered_unit_price=line.unit_price,
        ))
    session.commit()

    log_audit(
        session, "purchase.recorded", actor_staff_id=uuid.UUID(staff_id),
        target_type="purchase", target_id=str(purchase.id),
        details={"total_amount": purchase.total_amount, "item_count": len(line_outs)},
    )

    supplier = session.get(Supplier, purchase.supplier_id) if purchase.supplier_id else None
    staff = session.get(Staff, purchase.created_by_staff_id)
    return PurchaseOut(
        id=purchase.id, supplier_id=purchase.supplier_id, supplier_name=supplier.name if supplier else None,
        invoice_number=purchase.invoice_number, purchase_date=purchase.purchase_date, notes=purchase.notes,
        total_amount=purchase.total_amount, created_by_name=staff.full_name if staff else None,
        created_at=purchase.created_at, items=line_outs,
    )


@router.get("/purchases", response_model=list[PurchaseOut])
def list_purchases(
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    purchases = session.exec(select(Purchase).order_by(Purchase.created_at.desc()).limit(limit)).all()
    results = []
    for purchase in purchases:
        lines = session.exec(select(PurchaseItem).where(PurchaseItem.purchase_id == purchase.id)).all()
        supplier = session.get(Supplier, purchase.supplier_id) if purchase.supplier_id else None
        staff = session.get(Staff, purchase.created_by_staff_id)
        line_outs = []
        for line in lines:
            item = session.get(InventoryItem, line.inventory_item_id)
            line_outs.append(PurchaseLineOut(
                inventory_item_id=line.inventory_item_id, inventory_item_name=item.name if item else "Unknown item",
                quantity=line.quantity, unit=unit_label(session, item) if item else "",
                unit_price=line.unit_price, line_total=line.line_total,
                entered_quantity=line.entered_quantity, entered_unit=line.entered_unit,
                entered_unit_price=line.entered_unit_price,
            ))
        results.append(PurchaseOut(
            id=purchase.id, supplier_id=purchase.supplier_id, supplier_name=supplier.name if supplier else None,
            invoice_number=purchase.invoice_number, purchase_date=purchase.purchase_date, notes=purchase.notes,
            total_amount=purchase.total_amount, created_by_name=staff.full_name if staff else None,
            created_at=purchase.created_at, items=line_outs,
        ))
    return results


# --- manual stock adjustments (wastage / correction only - purchases go through /purchases) ---

ADJUSTMENT_REASONS = {"wastage", "adjustment"}


class StockAdjustmentIn(BaseModel):
    qty_delta: float  # negative = wastage/shrinkage, either sign = correction
    reason: str
    notes: str | None = None


class StockMovementOut(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID
    inventory_item_name: str
    qty_delta: float
    reason: str
    unit_price: float | None
    processing_date: date
    created_by_staff_id: uuid.UUID
    created_by_name: str | None
    created_at: datetime


@router.post("/items/{item_id}/adjust", response_model=InventoryItemOut)
def adjust_stock(
    item_id: uuid.UUID,
    payload: StockAdjustmentIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.adjust_stock")),
):
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.reason not in ADJUSTMENT_REASONS:
        raise HTTPException(status_code=400, detail=f"Reason must be one of {sorted(ADJUSTMENT_REASONS)}")
    if payload.qty_delta == 0:
        raise HTTPException(status_code=400, detail="Quantity change can't be zero")

    item.qty_on_hand += payload.qty_delta
    session.add(item)
    session.add(StockMovement(
        inventory_item_id=item_id, qty_delta=payload.qty_delta, reason=payload.reason,
        processing_date=get_processing_date(session), created_by_staff_id=uuid.UUID(staff_id),
    ))
    session.commit()
    session.refresh(item)
    log_audit(
        session, "inventory_item.stock_adjusted", actor_staff_id=uuid.UUID(staff_id),
        target_type="inventory_item", target_id=str(item_id),
        details={"qty_delta": payload.qty_delta, "reason": payload.reason, "notes": payload.notes},
    )
    return _item_to_out(session, item)


def _movement_to_out(session: Session, m: StockMovement) -> StockMovementOut:
    item = session.get(InventoryItem, m.inventory_item_id)
    staff = session.get(Staff, m.created_by_staff_id)
    return StockMovementOut(
        id=m.id, inventory_item_id=m.inventory_item_id, inventory_item_name=item.name if item else "Unknown item",
        qty_delta=m.qty_delta, reason=m.reason, unit_price=m.unit_price, processing_date=m.processing_date,
        created_by_staff_id=m.created_by_staff_id, created_by_name=staff.full_name if staff else None,
        created_at=m.created_at,
    )


@router.get("/items/{item_id}/movements", response_model=list[StockMovementOut])
def get_item_movements(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    rows = session.exec(
        select(StockMovement).where(StockMovement.inventory_item_id == item_id).order_by(StockMovement.created_at.desc())
    ).all()
    return [_movement_to_out(session, m) for m in rows]


@router.get("/movements", response_model=list[StockMovementOut])
def list_movements(
    limit: int = Query(default=200, le=1000),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("inventory.page.view")),
):
    rows = session.exec(select(StockMovement).order_by(StockMovement.created_at.desc()).limit(limit)).all()
    return [_movement_to_out(session, m) for m in rows]



@router.put("/purchases/{purchase_id}", response_model=PurchaseOut)
def update_purchase(
    purchase_id: uuid.UUID,
    payload: PurchaseIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("inventory.button.edit_purchase")),
):
    """Correct a recorded purchase (quantities, prices, units, items, supplier,
    invoice, date, notes). Stock moves by the DIFFERENCE only, each change is
    logged as "purchase_edit", and an edit that would take stock below zero
    (because some of it was already used) is refused with a clear reason."""
    purchase = session.get(Purchase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    items_with_records = _check_purchase_lines(session, payload)

    old_lines = session.exec(select(PurchaseItem).where(PurchaseItem.purchase_id == purchase.id)).all()
    old_qty: dict[uuid.UUID, float] = {}
    for ln in old_lines:
        old_qty[ln.inventory_item_id] = old_qty.get(ln.inventory_item_id, 0.0) + ln.quantity
    new_lines = []
    new_qty: dict[uuid.UUID, float] = {}
    for line, item, (_, entered_abbr, to_item_unit) in items_with_records:
        stock_qty = round(line.quantity * to_item_unit, 6)
        new_lines.append((line, item, entered_abbr, to_item_unit, stock_qty))
        new_qty[item.id] = new_qty.get(item.id, 0.0) + stock_qty

    # Stock can't go below zero: whatever was already used stays used.
    from app.services.number_format import get_decimals
    qty_dp = get_decimals(session)[1]
    problems = []
    deltas: dict[uuid.UUID, float] = {}
    for item_id in set(old_qty) | set(new_qty):
        delta = round(new_qty.get(item_id, 0.0) - old_qty.get(item_id, 0.0), 6)
        if abs(delta) < 1e-9:
            continue
        deltas[item_id] = delta
        item = session.get(InventoryItem, item_id)
        if item and item.qty_on_hand + delta < -1e-9:
            unit = unit_label(session, item)
            problems.append(
                f"{item.name}: only {round(item.qty_on_hand, qty_dp):g} {unit} is left in stock (the rest has been used), "
                f"so this purchase can be reduced by at most {round(item.qty_on_hand, qty_dp):g} {unit}"
            )
    if problems:
        raise HTTPException(status_code=400, detail="This change would take stock below zero. " + "; ".join(problems))

    before = {"total_amount": purchase.total_amount, "supplier_id": str(purchase.supplier_id) if purchase.supplier_id else None,
              "invoice_number": purchase.invoice_number, "purchase_date": purchase.purchase_date.isoformat(),
              "lines": [{"item": str(l.inventory_item_id), "quantity": l.quantity, "unit_price": l.unit_price} for l in old_lines]}

    for ln in old_lines:
        session.delete(ln)
    session.flush()
    for line, item, entered_abbr, to_item_unit, stock_qty in new_lines:
        session.add(PurchaseItem(
            id=uuid.uuid4(), purchase_id=purchase.id, inventory_item_id=item.id,
            quantity=stock_qty, unit_price=round(line.unit_price / to_item_unit, 6),
            line_total=round_amount(session, line.quantity * line.unit_price),
            entered_quantity=line.quantity, entered_unit=entered_abbr, entered_unit_price=line.unit_price,
        ))
    today = get_processing_date(session)
    for item_id, delta in deltas.items():
        item = session.get(InventoryItem, item_id)
        new_price = next((round(l.unit_price / t, 6) for l, it, _, t, _ in new_lines if it.id == item_id), None)
        session.add(StockMovement(
            inventory_item_id=item_id, qty_delta=delta, reason="purchase_edit", unit_price=new_price,
            purchase_id=purchase.id, processing_date=today, created_by_staff_id=uuid.UUID(staff_id),
        ))
        item.qty_on_hand = round(item.qty_on_hand + delta, 6)
        session.add(item)

    purchase.supplier_id = payload.supplier_id
    purchase.invoice_number = payload.invoice_number
    purchase.notes = payload.notes
    if payload.purchase_date:
        purchase.purchase_date = payload.purchase_date
    purchase.total_amount = round_amount(session, sum(round_amount(session, l.quantity * l.unit_price) for l, *_ in new_lines))
    session.add(purchase)
    session.commit()
    session.refresh(purchase)

    log_audit(
        session, "purchase.edited", actor_staff_id=uuid.UUID(staff_id), target_type="purchase", target_id=str(purchase.id),
        details={"before": before, "after": {"total_amount": purchase.total_amount,
                 "lines": [{"item": str(it.id), "quantity": q, "entered": f"{l.quantity:g} {a}"} for l, it, a, _, q in new_lines]},
                 "stock_changes": {str(k): v for k, v in deltas.items()}},
    )
    return _purchase_out(session, purchase)
