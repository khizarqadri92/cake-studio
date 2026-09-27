"""Every module must get today's business date from here — never datetime.now().

This lets the admin control what "today" means for the system, independent
of the server's actual clock, and keeps a full audit trail of changes.
"""
import uuid
from datetime import date, datetime, timezone
from sqlmodel import Session, select
from app.models.system import SystemConfig, ProcessingDateLog


DATE_MODES = ("processing", "system")


def system_today(session: Session) -> date:
    """The computer's calendar date in the organisation's time zone."""
    from app.models.organization import Organization
    org = session.get(Organization, 1)
    tz_name = (org.timezone if org and org.timezone else None) or "Asia/Karachi"
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz_name)).date()
    except Exception:  # time zone data unavailable
        return datetime.now(timezone.utc).date()


def _config(session: Session) -> SystemConfig:
    config = session.exec(select(SystemConfig).where(SystemConfig.id == 1)).first()
    if not config:
        config = SystemConfig(id=1)
        session.add(config)
        session.commit()
        session.refresh(config)
    return config


def get_processing_date(session: Session) -> date:
    """Today's business date - the one every module uses.

    In "system" mode it's the calendar date; in "processing" mode it's the
    date set by hand in System setup."""
    config = _config(session)
    if (config.date_mode or "processing") == "system":
        return system_today(session)
    return config.current_processing_date


def set_date_mode(session: Session, mode: str, changed_by_staff_id: uuid.UUID) -> SystemConfig:
    if mode not in DATE_MODES:
        raise ValueError("Date mode must be 'processing' or 'system'")
    config = _config(session)
    if config.date_mode == mode:
        return config
    if mode == "processing":
        # Resume from today rather than an old stored date, so new orders
        # aren't suddenly dated in the past. Recorded in the date history.
        today = system_today(session)
        if config.current_processing_date != today:
            session.add(ProcessingDateLog(
                old_date=config.current_processing_date, new_date=today,
                changed_by_staff_id=changed_by_staff_id,
                reason="Switched from system date to processing date",
            ))
            config.current_processing_date = today
        config.is_day_locked = False
    config.date_mode = mode
    config.updated_at = datetime.now(timezone.utc)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config


def advance_processing_date(
    session: Session,
    new_date: date,
    changed_by_staff_id: uuid.UUID,
    reason: str | None = None,
) -> SystemConfig:
    config = _config(session)
    if (config.date_mode or "processing") == "system":
        raise ValueError("The system date is in use. Switch to processing date in System setup to set the date by hand.")
    if config.is_day_locked:
        raise ValueError("Current processing day is locked and cannot be changed")

    log = ProcessingDateLog(
        old_date=config.current_processing_date,
        new_date=new_date,
        changed_by_staff_id=changed_by_staff_id,
        reason=reason,
    )
    config.current_processing_date = new_date
    config.updated_at = datetime.now(timezone.utc)

    session.add(log)
    session.add(config)
    session.commit()
    session.refresh(config)
    return config
