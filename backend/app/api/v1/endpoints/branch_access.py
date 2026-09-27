import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.core.database import get_session
from app.core.permissions import require_permission, get_current_staff_id
from app.services.branch_access import get_role_branch_access, set_role_branch_access, get_effective_branch_access
from app.services.audit import log_audit

router = APIRouter()


class BranchAccessEntry(BaseModel):
    section_key: str
    field_key: str
    access_level: str


class SetBranchAccessRequest(BaseModel):
    role_id: uuid.UUID
    branch_id: uuid.UUID
    entries: list[BranchAccessEntry]


@router.get("/access/branch-access")
def read_branch_access(
    role_id: uuid.UUID = Query(...),
    branch_id: uuid.UUID = Query(...),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("permissions.role.assign_permission")),
):
    return get_role_branch_access(session, role_id, branch_id)


@router.put("/access/branch-access")
def update_branch_access(
    payload: SetBranchAccessRequest,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("permissions.role.assign_permission")),
):
    valid_levels = {"enable", "disable", "view_only"}
    entries = [
        (e.section_key, e.field_key, e.access_level)
        for e in payload.entries
        if e.access_level in valid_levels
    ]
    set_role_branch_access(session, payload.role_id, payload.branch_id, entries)
    log_audit(
        session, "branch_access.changed", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="branch", target_id=str(payload.branch_id),
        details={"role_id": str(payload.role_id), "entries": [e.model_dump() for e in payload.entries]},
    )
    return get_role_branch_access(session, payload.role_id, payload.branch_id)


@router.get("/branches/{branch_id}/my-access")
def read_my_branch_access(
    branch_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    return get_effective_branch_access(session, uuid.UUID(staff_id), branch_id)
