from fastapi import Depends, HTTPException, status
from sqlmodel import Session
from app.core.database import get_session
from app.core.security import decode_access_token
from app.services.permission_service import has_permission
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_staff_id(token: str = Depends(oauth2_scheme)) -> str:
    try:
        payload = decode_access_token(token)
        return payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def require_any_permission(*permission_keys: str):
    """Allowed if the user has AT LEAST ONE of these permissions.
    e.g. reading the flavour list: whoever manages flavours OR takes orders."""

    def checker(
        staff_id: str = Depends(get_current_staff_id),
        session: Session = Depends(get_session),
    ):
        if not any(has_permission(session, staff_id, key) for key in permission_keys):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: one of {', '.join(permission_keys)}",
            )
        return staff_id

    return checker


def require_permission(permission_key: str):
    """Use as a route dependency: Depends(require_permission("orders.button.delete"))"""

    def checker(
        staff_id: str = Depends(get_current_staff_id),
        session: Session = Depends(get_session),
    ):
        if not has_permission(session, staff_id, permission_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_key}",
            )
        return staff_id

    return checker
