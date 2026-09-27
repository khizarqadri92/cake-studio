import uuid
from enum import Enum
from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field


class AccessLevel(str, Enum):
    ENABLE = "enable"        # visible and editable
    DISABLE = "disable"      # hidden entirely
    VIEW_ONLY = "view_only"  # visible, read-only


# Sentinel field_key for a control that applies to an entire section/branch
# rather than one specific field (e.g. "Main Branch Section" visibility).
SECTION_SENTINEL = "_section_"

# The section/field tree for a branch. Keys here drive both the permission
# tree shown on the Roles and permissions page and what the Branches page
# itself checks before rendering/allowing edits.
BRANCH_ACCESS_TREE: dict[str, list[str]] = {
    "main": [SECTION_SENTINEL],
    "contact": [
        "address_line1", "address_line2", "city", "state",
        "country", "postal_code", "phone", "email", "manager_staff_id",
    ],
    "hours": ["business_hours", "timezone", "currency"],
    "status": ["is_active", "is_default"],
}


class BranchFieldAccess(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("role_id", "branch_id", "section_key", "field_key", name="uq_role_branch_section_field"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    role_id: uuid.UUID = Field(foreign_key="role.id")
    branch_id: uuid.UUID = Field(foreign_key="branch.id")
    section_key: str
    field_key: str
    access_level: AccessLevel = Field(default=AccessLevel.DISABLE)
