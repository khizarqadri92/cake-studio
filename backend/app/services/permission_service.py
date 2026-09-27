"""Resolves the effective permission set for a staff member.

Precedence: per-user DENY overrides > per-user GRANT overrides > role permissions.
"""
import uuid
from sqlmodel import Session, select
from app.models.staff import StaffRole
from app.models.permissions import (
    Permission,
    RolePermission,
    StaffPermissionOverride,
    OverrideEffect,
)


def get_effective_permissions(session: Session, staff_id: uuid.UUID) -> set[str]:
    role_ids = session.exec(
        select(StaffRole.role_id).where(StaffRole.staff_id == staff_id)
    ).all()

    role_perm_keys: set[str] = set()
    if role_ids:
        rows = session.exec(
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id.in_(role_ids))
        ).all()
        role_perm_keys = set(rows)

    overrides = session.exec(
        select(StaffPermissionOverride, Permission.key)
        .join(Permission, Permission.id == StaffPermissionOverride.permission_id)
        .where(StaffPermissionOverride.staff_id == staff_id)
    ).all()

    granted = {key for override, key in overrides if override.effect == OverrideEffect.GRANT}
    denied = {key for override, key in overrides if override.effect == OverrideEffect.DENY}

    return (role_perm_keys | granted) - denied


def has_permission(session: Session, staff_id: uuid.UUID, permission_key: str) -> bool:
    return permission_key in get_effective_permissions(session, staff_id)
