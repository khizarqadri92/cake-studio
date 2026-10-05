import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_any_permission, require_permission
from app.services.audit import log_audit
from app.models.customer import Customer

router = APIRouter()


class CustomerOut(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str
    email: str | None
    address_line1: str | None
    city: str | None
    notes: str | None


class CustomerCreate(BaseModel):
    full_name: str
    phone: str
    email: str | None = None
    address_line1: str | None = None
    city: str | None = None
    notes: str | None = None


class CustomerUpdate(CustomerCreate):
    @field_validator("full_name", "phone")
    @classmethod
    def _required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("is required")
        return v

    @field_validator("email", "address_line1", "city", "notes")
    @classmethod
    def _blank_is_none(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v


@router.get("/search", response_model=list[CustomerOut])
def search_customers(
    q: str = Query(..., min_length=2, description="Matches against name or phone"),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.page.view")),
):
    """Used by the order form's customer search - matches name or phone,
    so staff can type either and find the right person."""
    rows = session.exec(
        select(Customer).where(
            (Customer.full_name.ilike(f"%{q}%")) | (Customer.phone.ilike(f"%{q}%"))
        ).limit(10)
    ).all()
    return rows


@router.get("/by-phone/{phone}", response_model=CustomerOut)
def get_customer_by_phone(
    phone: str,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.page.view")),
):
    customer = session.exec(select(Customer).where(Customer.phone == phone)).first()
    if not customer:
        raise HTTPException(status_code=404, detail="No customer with that phone number")
    return customer


@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("orders.button.create")),
):
    if session.exec(select(Customer).where(Customer.phone == payload.phone)).first():
        raise HTTPException(status_code=400, detail="A customer with this phone number already exists")
    customer = Customer(id=uuid.uuid4(), **payload.model_dump())
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_any_permission("customers.field.edit", "orders.button.create")),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if payload.phone != customer.phone:
        other = session.exec(select(Customer).where(Customer.phone == payload.phone)).first()
        if other:
            raise HTTPException(status_code=400, detail=f"Another customer ({other.full_name}) already has the phone number {payload.phone}")
    fields = payload.model_dump()
    before = {k: getattr(customer, k) for k in fields}
    for key, value in fields.items():
        setattr(customer, key, value)
    session.add(customer)
    session.commit()
    session.refresh(customer)
    changed = {k: {"from": before[k], "to": fields[k]} for k in fields if before[k] != fields[k]}
    if changed:
        log_audit(session, "customer.updated", actor_staff_id=uuid.UUID(staff_id), target_type="customer",
                  target_id=str(customer.id), details={"changes": changed})
    return customer



# ---------------------------------------------------------------- Customers page

class CustomerListItem(CustomerOut):
    created_at: datetime
    orders: int
    total_spent: float
    last_order: str | None


class CustomerOrderRow(BaseModel):
    id: uuid.UUID
    order_number: str
    date: str | None
    due: str
    status: str
    total: float
    balance: float


class CustomerDetail(CustomerListItem):
    order_history: list[CustomerOrderRow]


def _order_stats(session: Session, customer_ids: list[uuid.UUID]) -> dict:
    from app.models.orders import Order, OrderStatus
    stats: dict = {}
    if not customer_ids:
        return stats
    for o in session.exec(select(Order).where(Order.customer_id.in_(customer_ids))).all():
        st = stats.setdefault(o.customer_id, {"orders": 0, "total_spent": 0.0, "last_order": None})
        if o.status in (OrderStatus.DRAFT, OrderStatus.CANCELLED):
            continue                       # not sales: drafts aren't agreed, cancelled never happened
        st["orders"] += 1
        st["total_spent"] += o.total
        d = (o.business_date or o.created_at.date()).isoformat()
        st["last_order"] = max(st["last_order"] or d, d)
    return stats


@router.get("", response_model=list[CustomerListItem])
def list_customers(
    q: str = Query(default="", description="search name, phone or email"),
    limit: int = Query(default=200, le=1000),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("customers.page.view")),
):
    stmt = select(Customer)
    term = q.strip()
    if term:
        like = f"%{term}%"
        stmt = stmt.where(Customer.full_name.ilike(like) | Customer.phone.ilike(like) | Customer.email.ilike(like))
    customers = session.exec(stmt.order_by(Customer.full_name).limit(limit)).all()
    stats = _order_stats(session, [c.id for c in customers])
    empty = {"orders": 0, "total_spent": 0.0, "last_order": None}
    return [CustomerListItem(**CustomerOut.model_validate(c, from_attributes=True).model_dump(), created_at=c.created_at,
                             **stats.get(c.id, empty)) for c in customers]


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(
    customer_id: uuid.UUID,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("customers.page.view")),
):
    from app.models.orders import Order, OrderStatus
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    stats = _order_stats(session, [customer.id]).get(customer.id, {"orders": 0, "total_spent": 0.0, "last_order": None})
    rows = []
    for o in session.exec(select(Order).where(Order.customer_id == customer.id).order_by(Order.created_at.desc())).all():
        paid = o.advance_paid or 0
        if o.status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
            paid += (o.rider_amount_collected if o.rider_amount_collected is not None else (o.amount_received or 0))
        rows.append(CustomerOrderRow(
            id=o.id, order_number=o.order_number, date=o.business_date.isoformat() if o.business_date else None,
            due=o.delivery_date.isoformat(), status=o.status.value if hasattr(o.status, "value") else str(o.status),
            total=o.total, balance=0.0 if o.status == OrderStatus.CANCELLED else max(o.total - paid, 0),
        ))
    return CustomerDetail(**CustomerOut.model_validate(customer, from_attributes=True).model_dump(), created_at=customer.created_at,
                          **stats, order_history=rows)
