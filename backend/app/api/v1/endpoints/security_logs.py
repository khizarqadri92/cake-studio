import uuid
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
from app.models.audit import LoginHistory, AuditLog

router = APIRouter()


class LoginHistoryOut(BaseModel):
    id: uuid.UUID
    attempted_email: str
    staff_id: uuid.UUID | None
    success: bool
    failure_reason: str | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor_staff_id: uuid.UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    details: dict | None
    ip_address: str | None
    created_at: datetime


@router.get("/login-history", response_model=list[LoginHistoryOut])
def list_login_history(
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("login_history.page.view")),
):
    rows = session.exec(
        select(LoginHistory).order_by(LoginHistory.created_at.desc()).limit(limit)
    ).all()
    return rows


@router.get("/audit-trail", response_model=list[AuditLogOut])
def list_audit_trail(
    limit: int = Query(default=100, le=500),
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("audit_trail.page.view")),
):
    rows = session.exec(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return rows
