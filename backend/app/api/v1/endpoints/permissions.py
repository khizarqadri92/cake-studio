import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_permission
from app.models.staff import Role, StaffRole
from app.models.permissions import Permission, RolePermission, StaffPermissionOverride
from app.services.audit import log_audit

router = APIRouter()


class RoleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    permission_keys: list[str]


class RoleCreate(BaseModel):
    name: str
    description: str | None = None


class RoleUpdate(BaseModel):
    name: str
    description: str | None = None


class SetRolePermissions(BaseModel):
    permission_keys: list[str]


class PermissionOut(BaseModel):
    id: uuid.UUID
    key: str
    description: str | None


def _role_to_out(session: Session, role: Role) -> RoleOut:
    keys = session.exec(
        select(Permission.key)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role.id)
    ).all()
    return RoleOut(id=role.id, name=role.name, description=role.description, permission_keys=sorted(keys))


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("permissions.page.view")),
):
    roles = session.exec(select(Role)).all()
    return [_role_to_out(session, r) for r in roles]


@router.post("/roles", response_model=RoleOut)
def create_role(
    payload: RoleCreate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("permissions.role.create")),
):
    if session.exec(select(Role).where(Role.name == payload.name)).first():
        raise HTTPException(status_code=400, detail="A role with this name already exists")
    role = Role(id=uuid.uuid4(), name=payload.name, description=payload.description)
    session.add(role)
    session.commit()
    session.refresh(role)
    return _role_to_out(session, role)


@router.put("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("permissions.role.edit")),
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.name = payload.name
    role.description = payload.description
    session.add(role)
    session.commit()
    session.refresh(role)
    return _role_to_out(session, role)


@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
def set_role_permissions(
    role_id: uuid.UUID,
    payload: SetRolePermissions,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("permissions.role.assign_permission")),
):
    """Replaces the role's entire permission set with the given list of keys."""
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    wanted_perms = session.exec(
        select(Permission).where(Permission.key.in_(payload.permission_keys))
    ).all()
    found_keys = {p.key for p in wanted_perms}
    unknown = set(payload.permission_keys) - found_keys
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown permission keys: {sorted(unknown)}")

    existing = session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all()
    for rp in existing:
        session.delete(rp)
    session.commit()

    for perm in wanted_perms:
        session.add(RolePermission(role_id=role_id, permission_id=perm.id))
    session.commit()

    log_audit(
        session, "role.permissions_changed", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="role", target_id=str(role_id), details={"permission_keys": payload.permission_keys},
    )
    return _role_to_out(session, role)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: uuid.UUID,
    session: Session = Depends(get_session),
    acting_staff_id: str = Depends(require_permission("permissions.role.delete")),
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    assigned = session.exec(select(StaffRole).where(StaffRole.role_id == role_id)).first()
    if assigned:
        raise HTTPException(
            status_code=400,
            detail="This role is still assigned to at least one staff member. Reassign them first.",
        )

    for rp in session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all():
        session.delete(rp)
    session.delete(role)
    session.commit()

    log_audit(
        session, "role.deleted", actor_staff_id=uuid.UUID(acting_staff_id),
        target_type="role", target_id=str(role_id), details={"name": role.name},
    )
    return {"status": "ok"}


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_permission("permissions.page.view")),
):
    perms = session.exec(select(Permission).order_by(Permission.key)).all()
    return [PermissionOut(id=p.id, key=p.key, description=p.description) for p in perms]


# --- per-staff permission overrides ---

class OverrideOut(BaseModel):
    permission_key: str
    effect: str
    reason: str | None


class OverrideSet(BaseModel):
    permission_key: str
    effect: str  # "grant" or "deny"
    reason: str | None = None


@router.get("/staff/{staff_id}/overrides", response_model=list[OverrideOut])
def list_staff_overrides(
    staff_id: uuid.UUID,
    session: Session = Depends(get_session),
    _acting_staff_id: str = Depends(require_permission("permissions.staffoverride.edit")),
):
    rows = session.exec(
        select(StaffPermissionOverride, Permission.key)
        .join(Permission, Permission.id == StaffPermissionOverride.permission_id)
        .where(StaffPermissionOverride.staff_id == staff_id)
    ).all()
    return [
        OverrideOut(permission_key=key, effect=o.effect, reason=o.reason)
        for o, key in rows
    ]


@router.put("/staff/{staff_id}/overrides", response_model=list[OverrideOut])
def set_staff_overrides(
    staff_id: uuid.UUID,
    payload: list[OverrideSet],
    session: Session = Depends(get_session),
    _acting_staff_id: str = Depends(require_permission("permissions.staffoverride.edit")),
):
    """Replaces this staff member's entire override set."""
    existing = session.exec(
        select(StaffPermissionOverride).where(StaffPermissionOverride.staff_id == staff_id)
    ).all()
    for row in existing:
        session.delete(row)
    session.commit()

    for item in payload:
        perm = session.exec(select(Permission).where(Permission.key == item.permission_key)).first()
        if not perm:
            raise HTTPException(status_code=400, detail=f"Unknown permission key: {item.permission_key}")
        if item.effect not in ("grant", "deny"):
            raise HTTPException(status_code=400, detail="effect must be 'grant' or 'deny'")
        session.add(
            StaffPermissionOverride(
                staff_id=staff_id,
                permission_id=perm.id,
                effect=item.effect,
                reason=item.reason,
            )
        )
    session.commit()

    return list_staff_overrides(staff_id, session, _acting_staff_id)
