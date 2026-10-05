from datetime import date
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.system import SystemConfig
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission, get_current_staff_id
from app.services.number_format import get_decimals, MAX_DECIMALS
from app.services.audit import log_audit
from app.services.processing_date import get_processing_date, advance_processing_date
from app.services.employee_code import get_employee_code_settings, generate_employee_code

router = APIRouter()


class AdvanceDateRequest(BaseModel):
    new_date: date
    reason: str | None = None


@router.get("/processing-date")
def read_processing_date(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(get_current_staff_id),
):
    config = session.get(SystemConfig, 1)
    mode = (config.date_mode if config else None) or "processing"
    return {
        "processing_date": get_processing_date(session),
        "is_day_locked": bool(config.is_day_locked) if config and mode == "processing" else False,
        "date_mode": mode,
    }


class DateModeUpdate(BaseModel):
    date_mode: str


@router.put("/date-mode")
def update_date_mode(
    payload: DateModeUpdate,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("system.config.field.processing_date.edit")),
):
    """Use the computer's date, or a processing date set by hand."""
    from app.services.processing_date import set_date_mode
    try:
        config = set_date_mode(session, payload.date_mode, uuid.UUID(staff_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    log_audit(session, "system.date_mode_changed", actor_staff_id=uuid.UUID(staff_id), target_type="system",
              target_id="1", details={"date_mode": config.date_mode})
    return {"processing_date": get_processing_date(session), "date_mode": config.date_mode,
            "is_day_locked": bool(config.is_day_locked) if config.date_mode == "processing" else False}


@router.put("/processing-date")
def update_processing_date(
    payload: AdvanceDateRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("system.config.field.processing_date.edit")),
):
    try:
        config = advance_processing_date(session, payload.new_date, staff_id, payload.reason)
    except ValueError as exc:  # e.g. the day is locked
        raise HTTPException(status_code=400, detail=str(exc))
    return {"processing_date": config.current_processing_date}


class EmployeeCodeFormatOut(BaseModel):
    prefix: str
    separator: str
    padding: int
    include_year: bool
    next_sequence: int
    preview: str


class EmployeeCodeFormatUpdate(BaseModel):
    prefix: str
    separator: str
    padding: int
    include_year: bool


def _preview(settings) -> str:
    from datetime import datetime, timezone
    parts = [settings.prefix]
    if settings.include_year:
        parts.append(str(datetime.now(timezone.utc).year))
    parts.append(str(settings.next_sequence).zfill(settings.padding))
    return settings.separator.join(parts)


@router.get("/employee-code-format", response_model=EmployeeCodeFormatOut)
def read_employee_code_format(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("system.config.page.view")),
):
    settings = get_employee_code_settings(session)
    return EmployeeCodeFormatOut(
        prefix=settings.prefix, separator=settings.separator, padding=settings.padding,
        include_year=settings.include_year, next_sequence=settings.next_sequence,
        preview=_preview(settings),
    )


@router.put("/employee-code-format", response_model=EmployeeCodeFormatOut)
def update_employee_code_format(
    payload: EmployeeCodeFormatUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("system.config.field.employee_code_format.edit")),
):
    settings = get_employee_code_settings(session)
    settings.prefix = payload.prefix
    settings.separator = payload.separator
    settings.padding = payload.padding
    settings.include_year = payload.include_year
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return EmployeeCodeFormatOut(
        prefix=settings.prefix, separator=settings.separator, padding=settings.padding,
        include_year=settings.include_year, next_sequence=settings.next_sequence,
        preview=_preview(settings),
    )


# --- Decimal places + number format (read by every page to format numbers) ---

class NumberFormatUpdate(BaseModel):
    amount_decimals: int
    quantity_decimals: int


def _number_format_out(session: Session) -> dict:
    from app.models.organization import Organization
    amount, qty = get_decimals(session)
    org = session.exec(select(Organization)).first()
    return {
        "amount_decimals": amount,
        "quantity_decimals": qty,
        # Separators come from Organization > Locale > Number format
        "number_format": (org.number_format if org and org.number_format else "1,234.56"),
        # Shown to every signed-in user: the order form needs them for the
        # delivery-time dropdown (12/24-hour, and which times the shop is open).
        "time_format": (org.time_format if org and org.time_format else "hh:mm A"),
        "business_hours": (org.business_hours if org and org.business_hours else None),
    }


@router.get("/number-format")
def read_number_format(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(get_current_staff_id),
):
    """Any signed-in staff member can read this - every screen needs it to show numbers."""
    return _number_format_out(session)


@router.put("/number-format")
def update_number_format(
    payload: NumberFormatUpdate,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("system.config.field.decimals.edit")),
):
    for label, v in (("Amount", payload.amount_decimals), ("Quantity", payload.quantity_decimals)):
        if not 0 <= v <= MAX_DECIMALS:
            raise HTTPException(status_code=400, detail=f"{label} decimal places must be between 0 and {MAX_DECIMALS}")
    config = session.get(SystemConfig, 1)
    if not config:
        raise HTTPException(status_code=404, detail="System settings not found")
    before = {"amount_decimals": config.amount_decimals, "quantity_decimals": config.quantity_decimals}
    config.amount_decimals = payload.amount_decimals
    config.quantity_decimals = payload.quantity_decimals
    session.add(config)
    session.commit()
    log_audit(
        session, "system.decimal_places_changed", actor_staff_id=uuid.UUID(staff_id), target_type="system",
        target_id="1", details={"before": before, "after": payload.model_dump()},
    )
    return _number_format_out(session)


# --- Kitchen ticket printer ---

class PrinterSettings(BaseModel):
    printer_mode: str          # "browser" | "network" | "off"
    printer_host: str | None = None
    printer_port: int = 9100
    printer_width: int = 48    # 48 = 80 mm paper, 32 = 58 mm
    phone_country_code: str = "92"


def _printer_out(config: SystemConfig) -> dict:
    return PrinterSettings(
        printer_mode=config.printer_mode, printer_host=config.printer_host, printer_port=config.printer_port,
        printer_width=config.printer_width, phone_country_code=config.phone_country_code,
    ).model_dump()


@router.get("/printer")
def read_printer(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(get_current_staff_id),
):
    config = session.get(SystemConfig, 1)
    if not config:
        raise HTTPException(status_code=404, detail="System settings not found")
    return _printer_out(config)


@router.put("/printer")
def update_printer(
    payload: PrinterSettings,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("system.config.field.printer.edit")),
):
    if payload.printer_mode not in ("browser", "network", "off"):
        raise HTTPException(status_code=400, detail="Printing must be browser, network or off")
    host = (payload.printer_host or "").strip() or None
    if payload.printer_mode == "network" and not host:
        raise HTTPException(status_code=400, detail="Enter the printer's IP address for network printing")
    if not 1 <= payload.printer_port <= 65535:
        raise HTTPException(status_code=400, detail="Port must be between 1 and 65535")
    if payload.printer_width not in (32, 42, 48):
        raise HTTPException(status_code=400, detail="Paper width must be 58 mm (32), 76 mm (42) or 80 mm (48)")
    code = "".join(ch for ch in payload.phone_country_code if ch.isdigit())
    if not code:
        raise HTTPException(status_code=400, detail="Enter a country calling code, for example 92")
    config = session.get(SystemConfig, 1)
    config.printer_mode, config.printer_host, config.printer_port = payload.printer_mode, host, payload.printer_port
    config.printer_width, config.phone_country_code = payload.printer_width, code
    session.add(config)
    session.commit()
    log_audit(session, "system.printer_changed", actor_staff_id=uuid.UUID(staff_id), target_type="system",
              target_id="1", details=_printer_out(config))
    return _printer_out(config)


@router.post("/printer/test")
def test_printer(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("system.config.field.printer.edit")),
):
    """Sends a short test ticket to the network printer and reports the result."""
    from app.services.receipt import send_to_network_printer
    config = session.get(SystemConfig, 1)
    if config.printer_mode != "network" or not config.printer_host:
        raise HTTPException(status_code=400, detail="Save a network printer address first")
    width = config.printer_width
    payload = (b"\x1b@\x1ba\x01\x1bE\x01" + b"Cake Studio test print\n" + b"\x1bE\x00"
               + ("-" * width).encode() + b"\n" + b"If you can read this, kitchen tickets will print here.\n"
               + b"\n\n\n\x1dV\x42\x00")
    try:
        send_to_network_printer(config.printer_host, config.printer_port, payload)
    except OSError as exc:
        raise HTTPException(status_code=502, detail=f"Couldn't reach the printer at {config.printer_host}:{config.printer_port}: {exc.strerror or exc}")
    return {"status": "sent", "printer": f"{config.printer_host}:{config.printer_port}"}
