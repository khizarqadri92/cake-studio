import uuid
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlmodel import Session
from app.core.database import get_session
from app.core.permissions import require_permission
from app.services.access_policy import get_policy

router = APIRouter()


class AccessPolicyOut(BaseModel):
    default_role_id: uuid.UUID | None
    password_min_length: int
    password_require_uppercase: bool
    password_require_number: bool
    password_require_symbol: bool
    password_expiry_days: int
    max_login_attempts: int
    lockout_duration_minutes: int
    session_timeout_minutes: int
    two_factor_required: bool
    ip_allowlist: str | None


class AccessPolicyUpdate(BaseModel):
    default_role_id: uuid.UUID | None = None
    password_min_length: int
    password_require_uppercase: bool
    password_require_number: bool
    password_require_symbol: bool
    password_expiry_days: int
    max_login_attempts: int
    lockout_duration_minutes: int
    session_timeout_minutes: int
    two_factor_required: bool
    ip_allowlist: str | None = None


@router.get("", response_model=AccessPolicyOut)
def read_access_policy(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("access_policy.page.view")),
):
    return get_policy(session)


@router.put("", response_model=AccessPolicyOut)
def update_access_policy(
    payload: AccessPolicyUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("access_policy.field.edit")),
):
    policy = get_policy(session)
    for key, value in payload.model_dump().items():
        setattr(policy, key, value)
    policy.updated_at = datetime.now(timezone.utc)
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return policy
