import uuid
from sqlmodel import Session, select
from app.models.branch_access import BranchFieldAccess, AccessLevel, BRANCH_ACCESS_TREE, SECTION_SENTINEL
from app.models.staff import Role, StaffRole, Staff
from app.models.branch import Branch

# Precedence when a staff member holds multiple roles with different levels
# on the same field: the most permissive wins.
_RANK = {AccessLevel.DISABLE: 0, AccessLevel.VIEW_ONLY: 1, AccessLevel.ENABLE: 2}


def get_role_branch_access(session: Session, role_id: uuid.UUID, branch_id: uuid.UUID) -> dict[str, dict[str, str]]:
    """Returns the full section/field tree for one role+branch, defaulting to 'disable'."""
    rows = session.exec(
        select(BranchFieldAccess).where(
            BranchFieldAccess.role_id == role_id, BranchFieldAccess.branch_id == branch_id
        )
    ).all()
    by_key = {(r.section_key, r.field_key): r.access_level for r in rows}

    result: dict[str, dict[str, str]] = {}
    for section_key, fields in BRANCH_ACCESS_TREE.items():
        result[section_key] = {}
        for field_key in fields:
            result[section_key][field_key] = by_key.get((section_key, field_key), AccessLevel.DISABLE).value
    return result


def set_role_branch_access(
    session: Session,
    role_id: uuid.UUID,
    branch_id: uuid.UUID,
    entries: list[tuple[str, str, str]],  # (section_key, field_key, access_level)
) -> None:
    existing = session.exec(
        select(BranchFieldAccess).where(
            BranchFieldAccess.role_id == role_id, BranchFieldAccess.branch_id == branch_id
        )
    ).all()
    for row in existing:
        session.delete(row)
    session.commit()

    for section_key, field_key, access_level in entries:
        session.add(
            BranchFieldAccess(
                role_id=role_id, branch_id=branch_id,
                section_key=section_key, field_key=field_key, access_level=access_level,
            )
        )
    session.commit()


def get_effective_branch_access(session: Session, staff_id: uuid.UUID, branch_id: uuid.UUID) -> dict[str, dict[str, str]]:
    """Combines every role the staff holds, taking the most permissive level per field.

    If this staff member has a home branch assigned, that's a hard ceiling:
    no role's permissions can grant them access to a *different* branch,
    even if that role would normally allow it elsewhere.
    """
    all_disabled = {section: {field: AccessLevel.DISABLE.value for field in fields} for section, fields in BRANCH_ACCESS_TREE.items()}

    staff = session.get(Staff, staff_id)
    if staff and staff.branch_id and staff.branch_id != branch_id:
        return all_disabled

    role_ids = session.exec(select(StaffRole.role_id).where(StaffRole.staff_id == staff_id)).all()

    result: dict[str, dict[str, str]] = {
        section: {field: AccessLevel.DISABLE for field in fields}
        for section, fields in BRANCH_ACCESS_TREE.items()
    }
    if not role_ids:
        return all_disabled

    rows = session.exec(
        select(BranchFieldAccess).where(
            BranchFieldAccess.role_id.in_(role_ids), BranchFieldAccess.branch_id == branch_id
        )
    ).all()
    for row in rows:
        current = result.get(row.section_key, {}).get(row.field_key, AccessLevel.DISABLE)
        if _RANK[row.access_level] > _RANK[current]:
            result[row.section_key][row.field_key] = row.access_level

    return {s: {f: lvl.value for f, lvl in fields.items()} for s, fields in result.items()}


def section_access_level(effective: dict[str, dict[str, str]], section_key: str, field_key: str = SECTION_SENTINEL) -> str:
    return effective.get(section_key, {}).get(field_key, AccessLevel.DISABLE.value)


def grant_full_access_for_role(session: Session, role_name: str, branch_id: uuid.UUID) -> None:
    """Used at branch creation and seeding so the given role (e.g. Super Admin)
    isn't locked out of a branch nobody has explicitly configured access for yet."""
    role = session.exec(select(Role).where(Role.name == role_name)).first()
    if not role:
        return
    entries = [
        (section, field, AccessLevel.ENABLE.value)
        for section, fields in BRANCH_ACCESS_TREE.items()
        for field in fields
    ]
    set_role_branch_access(session, role.id, branch_id, entries)


def grant_full_access_for_all_branches(session: Session, role_name: str) -> None:
    for branch in session.exec(select(Branch)).all():
        grant_full_access_for_role(session, role_name, branch.id)
