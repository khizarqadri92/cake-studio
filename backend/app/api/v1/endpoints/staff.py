import uuid
from datetime import date, datetime, timezone
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
from app.core.security import hash_password
from app.models.staff import Staff, Role, StaffRole
from app.models.branch import Branch
from app.services.access_policy import get_policy, validate_password
from app.services.audit import log_audit
from app.services.employee_code import generate_employee_code

router = APIRouter()


class StaffOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    is_active: bool
    role_names: list[str]

    employee_code: str | None
    phone: str | None
    job_title: str | None
    department: str | None
    date_of_joining: date | None
    date_of_birth: date | None
    gender: str | None
    national_id: str | None
    employment_type: str | None
    basic_salary: float | None
    address_line1: str | None
    city: str | None
    country: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    branch_id: uuid.UUID | None
    branch_name: str | None


class StaffCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role_ids: list[uuid.UUID] = []

    phone: str | None = None
    job_title: str | None = None
    department: str | None = None
    date_of_joining: date | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    national_id: str | None = None
    employment_type: str | None = None
    basic_salary: float | None = None
    address_line1: str | None = None
    city: str | None = None
    country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    branch_id: uuid.UUID | None = None


class StaffUpdateProfile(BaseModel):
    full_name: str
    phone: str | None = None
    job_title: str | None = None
    department: str | None = None
    date_of_joining: date | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    national_id: str | None = None
    employment_type: str | None = None
    basic_salary: float | None = None
    address_line1: str | None = None
    city: str | None = None
    country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    branch_id: uuid.UUID | None = None


class SetStaffRoles(BaseModel):
    role_ids: list[uuid.UUID]


def _staff_to_out(session: Session, staff: Staff) -> StaffOut:
    names = session.exec(
        select(Role.name)
        .join(StaffRole, StaffRole.role_id == Role.id)
        .where(StaffRole.staff_id == staff.id)
    ).all()
    branch_name = None
    if staff.branch_id:
        branch = session.get(Branch, staff.branch_id)
        branch_name = branch.name if branch else None

    return StaffOut(
        id=staff.id,
        full_name=staff.full_name,
        email=staff.email,
        is_active=staff.is_active,
        role_names=sorted(names),
        employee_code=staff.employee_code,
        phone=staff.phone,
        job_title=staff.job_title,
        department=staff.department,
        date_of_joining=staff.date_of_joining,
        date_of_birth=staff.date_of_birth,
        gender=staff.gender,
        national_id=staff.national_id,
        employment_type=staff.employment_type,
        basic_salary=staff.basic_salary,
        address_line1=staff.address_line1,
        city=staff.city,
        country=staff.country,
        emergency_contact_name=staff.emergency_contact_name,
        emergency_contact_phone=staff.emergency_contact_phone,
        branch_id=staff.branch_id,
        branch_name=branch_name,
    )


@router.get("", response_model=list[StaffOut])
def list_staff(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("staff.page.view")),
):
    all_staff = session.exec(select(Staff)).all()
    return [_staff_to_out(session, s) for s in all_staff]


@router.post("", response_model=StaffOut)
def create_staff(
    payload: StaffCreate,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("staff.button.create")),
):
    if session.exec(select(Staff).where(Staff.email == payload.email)).first():
        raise HTTPException(status_code=400, detail="A staff account with this email already exists")

    if payload.branch_id and not session.get(Branch, payload.branch_id):
        raise HTTPException(status_code=400, detail="Unknown branch id")

    policy = get_policy(session)
    validate_password(payload.password, policy)

    staff = Staff(
        id=uuid.uuid4(),
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        created_at=datetime.now(timezone.utc),
        password_updated_at=datetime.now(timezone.utc),
        employee_code=generate_employee_code(session),  # auto-generated, format set in System setup
        phone=payload.phone,
        job_title=payload.job_title,
        department=payload.department,
        date_of_joining=payload.date_of_joining,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        national_id=payload.national_id,
        employment_type=payload.employment_type,
        basic_salary=payload.basic_salary,
        address_line1=payload.address_line1,
        city=payload.city,
        country=payload.country,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        branch_id=payload.branch_id,
    )
    session.add(staff)
    session.commit()
    session.refresh(staff)

    role_ids = payload.role_ids
    if not role_ids and policy.default_role_id:
        role_ids = [policy.default_role_id]

    for role_id in role_ids:
        if not session.get(Role, role_id):
            raise HTTPException(status_code=400, detail=f"Unknown role id: {role_id}")
        session.add(StaffRole(staff_id=staff.id, role_id=role_id))
    session.commit()

    log_audit(session, "staff.created", actor_staff_id=uuid.UUID(acting_staff_id), target_type="staff", target_id=str(staff.id))
    return _staff_to_out(session, staff)


@router.put("/{staff_id}/profile", response_model=StaffOut)
def update_staff_profile(
    staff_id: uuid.UUID,
    payload: StaffUpdateProfile,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("staff.field.profile.edit")),
):
    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if payload.branch_id and not session.get(Branch, payload.branch_id):
        raise HTTPException(status_code=400, detail="Unknown branch id")

    for key, value in payload.model_dump().items():
        setattr(staff, key, value)
    session.add(staff)
    session.commit()
    session.refresh(staff)

    log_audit(
        session, "staff.profile_updated", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="staff", target_id=str(staff_id),
    )
    return _staff_to_out(session, staff)


@router.put("/{staff_id}/roles", response_model=StaffOut)
def set_staff_roles(
    staff_id: uuid.UUID,
    payload: SetStaffRoles,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("staff.field.role.edit")),
):
    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    existing = session.exec(select(StaffRole).where(StaffRole.staff_id == staff_id)).all()
    for row in existing:
        session.delete(row)
    session.commit()

    for role_id in payload.role_ids:
        if not session.get(Role, role_id):
            raise HTTPException(status_code=400, detail=f"Unknown role id: {role_id}")
        session.add(StaffRole(staff_id=staff_id, role_id=role_id))
    session.commit()

    log_audit(
        session, "staff.roles_changed", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="staff", target_id=str(staff_id),
        details={"role_ids": [str(r) for r in payload.role_ids]},
    )
    return _staff_to_out(session, staff)


class SetStaffStatus(BaseModel):
    is_active: bool


@router.put("/{staff_id}/status", response_model=StaffOut)
def set_staff_status(
    staff_id: uuid.UUID,
    payload: SetStaffStatus,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("staff.field.status.edit")),
):
    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_active = payload.is_active
    session.add(staff)
    session.commit()
    session.refresh(staff)
    log_audit(
        session, "staff.status_changed", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="staff", target_id=str(staff_id), details={"is_active": payload.is_active},
    )
    return _staff_to_out(session, staff)
