import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission, get_current_staff_id
from app.models.branch import Branch
from app.services.branch_access import (
    get_effective_branch_access,
    section_access_level,
    grant_full_access_for_role,
)

router = APIRouter()


class BranchOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    country: str | None
    postal_code: str | None
    phone: str | None
    email: str | None
    manager_staff_id: uuid.UUID | None
    business_hours: dict
    timezone: str
    currency: str
    is_active: bool
    is_default: bool


class BranchCreate(BaseModel):
    name: str
    code: str
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_staff_id: uuid.UUID | None = None
    business_hours: dict | None = None
    timezone: str = "Asia/Karachi"
    currency: str = "PKR"


class BranchDetailsUpdate(BaseModel):
    name: str
    code: str
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    manager_staff_id: uuid.UUID | None = None


class BranchHoursUpdate(BaseModel):
    business_hours: dict
    timezone: str
    currency: str


class BranchStatusUpdate(BaseModel):
    is_active: bool


def require_branch_section_enabled(section_key: str):
    """Checks the acting staff's resolved per-branch access for this section
    (combining all their roles) is 'enable', not just 'view_only' or 'disable'."""

    def checker(
        branch_id: uuid.UUID,
        session: Session = Depends(get_session),
        staff_id: str = Depends(get_current_staff_id),
    ):
        effective = get_effective_branch_access(session, uuid.UUID(staff_id), branch_id)
        level = section_access_level(effective, section_key)
        if level != "enable":
            raise HTTPException(status_code=403, detail="You don't have edit access to this section for this branch")
        return staff_id

    return checker


@router.get("", response_model=list[BranchOut])
def list_branches(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("branches.page.view")),
):
    return session.exec(select(Branch)).all()


@router.post("", response_model=BranchOut)
def create_branch(
    payload: BranchCreate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("branches.button.create")),
):
    if session.exec(select(Branch).where(Branch.code == payload.code)).first():
        raise HTTPException(status_code=400, detail="A branch with this code already exists")

    data = payload.model_dump()
    is_first_branch = not session.exec(select(Branch)).first()
    branch = Branch(id=uuid.uuid4(), **data)
    if not data.get("business_hours"):
        branch.business_hours = Branch.model_fields["business_hours"].default_factory()
    branch.is_default = is_first_branch  # first branch created becomes the default automatically
    session.add(branch)
    session.commit()
    session.refresh(branch)

    # Super Admin isn't locked out of a branch nobody has explicitly configured access for yet.
    grant_full_access_for_role(session, "Super Admin", branch.id)

    return branch


@router.put("/{branch_id}/details", response_model=BranchOut)
def update_branch_details(
    branch_id: uuid.UUID,
    payload: BranchDetailsUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_branch_section_enabled("contact")),
):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    if payload.code != branch.code and session.exec(select(Branch).where(Branch.code == payload.code)).first():
        raise HTTPException(status_code=400, detail="A branch with this code already exists")

    for key, value in payload.model_dump().items():
        setattr(branch, key, value)
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.put("/{branch_id}/hours", response_model=BranchOut)
def update_branch_hours(
    branch_id: uuid.UUID,
    payload: BranchHoursUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_branch_section_enabled("hours")),
):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.business_hours = payload.business_hours
    branch.timezone = payload.timezone
    branch.currency = payload.currency
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.put("/{branch_id}/status", response_model=BranchOut)
def update_branch_status(
    branch_id: uuid.UUID,
    payload: BranchStatusUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_branch_section_enabled("status")),
):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    if branch.is_default and not payload.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate the default branch. Set another branch as default first.",
        )
    branch.is_active = payload.is_active
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch


@router.put("/{branch_id}/default", response_model=BranchOut)
def set_default_branch(
    branch_id: uuid.UUID,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_branch_section_enabled("status")),
):
    branch = session.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    if not branch.is_active:
        raise HTTPException(status_code=400, detail="Cannot set an inactive branch as default")

    all_branches = session.exec(select(Branch)).all()
    for b in all_branches:
        if b.is_default and b.id != branch_id:
            b.is_default = False
            session.add(b)
    branch.is_default = True
    session.add(branch)
    session.commit()
    session.refresh(branch)
    return branch
