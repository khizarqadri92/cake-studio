from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Request, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    generate_totp_secret,
    totp_provisioning_uri,
    verify_totp_code,
)
from app.core.permissions import get_current_staff_id
from app.models.staff import Staff, Role, StaffRole
from app.services.permission_service import get_effective_permissions
from app.services.access_policy import get_policy, validate_password, is_ip_allowed
from app.services.audit import log_login, log_audit

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _role_names(session: Session, staff_id) -> list[str]:
    return sorted(session.exec(
        select(Role.name).join(StaffRole, StaffRole.role_id == Role.id).where(StaffRole.staff_id == staff_id)
    ).all())


@router.post("/login")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    totp_code: str | None = Form(None),
    session: Session = Depends(get_session),
):
    ip = _client_ip(request)
    user_agent = request.headers.get("user-agent")
    policy = get_policy(session)

    if not is_ip_allowed(ip, policy):
        log_login(session, form_data.username, False, failure_reason="ip_restricted", ip_address=ip, user_agent=user_agent)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access from this network isn't permitted")

    # Emails are matched without regard to capitals or stray spaces, so
    # "Owner@CakeStudio.local " signs in the same as "owner@cakestudio.local".
    email = (form_data.username or "").strip()
    staff = session.exec(select(Staff).where(func.lower(Staff.email) == email.lower())).first()

    if staff and staff.locked_until and staff.locked_until > datetime.now(timezone.utc):
        log_login(session, form_data.username, False, staff_id=staff.id, failure_reason="account_locked", ip_address=ip, user_agent=user_agent)
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="Account is temporarily locked due to repeated failed logins")

    if not staff or not staff.is_active or not verify_password(form_data.password, staff.hashed_password):
        if staff:
            staff.failed_login_attempts += 1
            if staff.failed_login_attempts >= policy.max_login_attempts:
                staff.locked_until = datetime.now(timezone.utc) + timedelta(minutes=policy.lockout_duration_minutes)
                staff.failed_login_attempts = 0
                session.add(staff)
                session.commit()
                log_audit(session, "account.locked", target_type="staff", target_id=str(staff.id), ip_address=ip)
            else:
                session.add(staff)
                session.commit()
        log_login(session, form_data.username, False, staff_id=staff.id if staff else None, failure_reason="invalid_credentials", ip_address=ip, user_agent=user_agent)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if staff.totp_enabled:
        if not totp_code:
            log_login(session, form_data.username, False, staff_id=staff.id, failure_reason="totp_required", ip_address=ip, user_agent=user_agent)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="totp_required")
        if not verify_totp_code(staff.totp_secret, totp_code):
            log_login(session, form_data.username, False, staff_id=staff.id, failure_reason="totp_invalid", ip_address=ip, user_agent=user_agent)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticator code")

    staff.failed_login_attempts = 0
    session.add(staff)
    session.commit()

    token = create_access_token(subject=str(staff.id), expires_minutes=policy.session_timeout_minutes)
    permissions_list = get_effective_permissions(session, staff.id)
    log_login(session, form_data.username, True, staff_id=staff.id, ip_address=ip, user_agent=user_agent)

    password_expired = False
    if policy.password_expiry_days > 0:
        age_days = (datetime.now(timezone.utc) - staff.password_updated_at).days
        password_expired = age_days > policy.password_expiry_days

    return {
        "access_token": token,
        "token_type": "bearer",
        "staff": {
            "id": str(staff.id),
            "full_name": staff.full_name,
            "email": staff.email,
            "totp_enabled": staff.totp_enabled,
            "preferred_language": staff.preferred_language,
            "theme_preference": staff.theme_preference,
            "color_palette": staff.color_palette,
            "role_names": _role_names(session, staff.id),
        },
        "permissions": sorted(permissions_list),
        "password_expired": password_expired,
        "two_factor_required_by_policy": policy.two_factor_required and not staff.totp_enabled,
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    staff = session.get(Staff, staff_id)
    if not staff or not verify_password(payload.current_password, staff.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    policy = get_policy(session)
    validate_password(payload.new_password, policy)

    staff.hashed_password = hash_password(payload.new_password)
    staff.password_updated_at = datetime.now(timezone.utc)
    session.add(staff)
    session.commit()
    log_audit(session, "password.changed", actor_staff_id=staff.id, target_type="staff", target_id=str(staff.id))
    return {"status": "ok"}


@router.post("/2fa/setup")
def setup_two_factor(
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    staff = session.get(Staff, staff_id)
    secret = generate_totp_secret()
    staff.totp_secret = secret
    session.add(staff)
    session.commit()
    return {"secret": secret, "provisioning_uri": totp_provisioning_uri(secret, staff.email)}


class VerifyTotpRequest(BaseModel):
    code: str


@router.post("/2fa/verify")
def verify_two_factor(
    payload: VerifyTotpRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    staff = session.get(Staff, staff_id)
    if not staff.totp_secret or not verify_totp_code(staff.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    staff.totp_enabled = True
    session.add(staff)
    session.commit()
    log_audit(session, "2fa.enabled", actor_staff_id=staff.id, target_type="staff", target_id=str(staff.id))
    return {"status": "ok"}


@router.post("/2fa/disable")
def disable_two_factor(
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    staff = session.get(Staff, staff_id)
    staff.totp_enabled = False
    staff.totp_secret = None
    session.add(staff)
    session.commit()
    log_audit(session, "2fa.disabled", actor_staff_id=staff.id, target_type="staff", target_id=str(staff.id))
    return {"status": "ok"}


@router.get("/me")
def read_current_staff(
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    staff = session.get(Staff, staff_id)
    permissions_list = get_effective_permissions(session, staff.id)
    return {
        "staff": {
            "id": str(staff.id),
            "full_name": staff.full_name,
            "email": staff.email,
            "totp_enabled": staff.totp_enabled,
            "preferred_language": staff.preferred_language,
            "theme_preference": staff.theme_preference,
            "color_palette": staff.color_palette,
            "role_names": _role_names(session, staff.id),
        },
        "permissions": sorted(permissions_list),
    }


class SetLanguageRequest(BaseModel):
    language: str | None  # None resets to "use the organization's default"


@router.put("/me/language")
def set_my_language(
    payload: SetLanguageRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    """Self-service: any signed-in staff member can set their own display
    language. This only affects their own account, never anyone else's."""
    staff = session.get(Staff, staff_id)
    staff.preferred_language = payload.language
    session.add(staff)
    session.commit()
    return {"preferred_language": staff.preferred_language}


class SetThemeRequest(BaseModel):
    theme: str | None  # "light" | "dark" | "system" | None


@router.put("/me/theme")
def set_my_theme(
    payload: SetThemeRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    """Self-service: light/dark/system, this staff member's account only."""
    if payload.theme not in (None, "light", "dark", "system"):
        raise HTTPException(status_code=400, detail="theme must be 'light', 'dark', 'system', or null")
    staff = session.get(Staff, staff_id)
    staff.theme_preference = payload.theme
    session.add(staff)
    session.commit()
    return {"theme_preference": staff.theme_preference}


VALID_PALETTES = {"plum", "ocean", "forest", "berry", "slate"}


class SetPaletteRequest(BaseModel):
    palette: str | None


@router.put("/me/palette")
def set_my_palette(
    payload: SetPaletteRequest,
    session: Session = Depends(get_session),
    staff_id: str = Depends(get_current_staff_id),
):
    """Self-service: color palette, this staff member's account only."""
    if payload.palette is not None and payload.palette not in VALID_PALETTES:
        raise HTTPException(status_code=400, detail=f"palette must be one of {sorted(VALID_PALETTES)} or null")
    staff = session.get(Staff, staff_id)
    staff.color_palette = payload.palette
    session.add(staff)
    session.commit()
    return {"color_palette": staff.color_palette}
