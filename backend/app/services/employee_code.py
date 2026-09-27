from datetime import datetime, timezone
from sqlmodel import Session, select
from app.models.employee_code import EmployeeCodeSettings


def get_employee_code_settings(session: Session) -> EmployeeCodeSettings:
    settings = session.exec(select(EmployeeCodeSettings).where(EmployeeCodeSettings.id == 1)).first()
    if not settings:
        settings = EmployeeCodeSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def generate_employee_code(session: Session) -> str:
    """Builds the next code from the configured format and advances the
    sequence counter - each call is guaranteed to hand out a unique code."""
    settings = get_employee_code_settings(session)

    parts = [settings.prefix]
    if settings.include_year:
        parts.append(str(datetime.now(timezone.utc).year))
    parts.append(str(settings.next_sequence).zfill(settings.padding))
    code = settings.separator.join(parts)

    settings.next_sequence += 1
    settings.updated_at = datetime.now(timezone.utc)
    session.add(settings)
    session.commit()

    return code
