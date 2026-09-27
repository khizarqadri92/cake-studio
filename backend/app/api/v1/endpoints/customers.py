import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
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
    pass


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
    _staff_id: str = Depends(require_permission("orders.button.create")),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if payload.phone != customer.phone and session.exec(select(Customer).where(Customer.phone == payload.phone)).first():
        raise HTTPException(status_code=400, detail="A customer with this phone number already exists")
    for key, value in payload.model_dump().items():
        setattr(customer, key, value)
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer
