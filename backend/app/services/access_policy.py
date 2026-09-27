from sqlmodel import Session, select
from fastapi import HTTPException
from app.models.access import AccessPolicy


def get_policy(session: Session) -> AccessPolicy:
    policy = session.exec(select(AccessPolicy).where(AccessPolicy.id == 1)).first()
    if not policy:
        policy = AccessPolicy(id=1)
        session.add(policy)
        session.commit()
        session.refresh(policy)
    return policy


def validate_password(password: str, policy: AccessPolicy) -> None:
    errors = []
    if len(password) < policy.password_min_length:
        errors.append(f"Password must be at least {policy.password_min_length} characters")
    if policy.password_require_uppercase and not any(c.isupper() for c in password):
        errors.append("Password must include an uppercase letter")
    if policy.password_require_number and not any(c.isdigit() for c in password):
        errors.append("Password must include a number")
    if policy.password_require_symbol and password.isalnum():
        errors.append("Password must include a symbol")
    if errors:
        raise HTTPException(status_code=400, detail=errors)


def is_ip_allowed(ip: str | None, policy: AccessPolicy) -> bool:
    if not policy.ip_allowlist or not policy.ip_allowlist.strip():
        return True
    if not ip:
        return False
    import ipaddress

    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False

    for entry in policy.ip_allowlist.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            elif addr == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False
