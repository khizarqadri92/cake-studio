import uuid
from sqlmodel import Session
from app.models.audit import LoginHistory, AuditLog


def log_login(
    session: Session,
    attempted_email: str,
    success: bool,
    staff_id: uuid.UUID | None = None,
    failure_reason: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    session.add(
        LoginHistory(
            attempted_email=attempted_email,
            staff_id=staff_id,
            success=success,
            failure_reason=failure_reason,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
    session.commit()


def log_audit(
    session: Session,
    action: str,
    actor_staff_id: uuid.UUID | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_staff_id=actor_staff_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
        )
    )
    session.commit()
