import uuid
from enum import Enum
from sqlmodel import SQLModel, Field


class OverrideEffect(str, Enum):
    GRANT = "grant"
    DENY = "deny"


class Permission(SQLModel, table=True):
    """A single permission key.

    Convention: {module}.{page}.{element_type}.{element_name}.{action}
    e.g. orders.orderform.field.price.edit
         orders.orderform.button.approve.execute
         inventory.stocklist.page.view
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    key: str = Field(unique=True, index=True)
    description: str | None = None


class RolePermission(SQLModel, table=True):
    role_id: uuid.UUID = Field(foreign_key="role.id", primary_key=True)
    permission_id: uuid.UUID = Field(foreign_key="permission.id", primary_key=True)


class StaffPermissionOverride(SQLModel, table=True):
    """Per-user exception on top of role permissions.

    effect=grant adds a permission the staff's role(s) don't include.
    effect=deny removes a permission the staff's role(s) would otherwise give.
    Overrides always win over role-derived permissions.
    """

    staff_id: uuid.UUID = Field(foreign_key="staff.id", primary_key=True)
    permission_id: uuid.UUID = Field(foreign_key="permission.id", primary_key=True)
    effect: OverrideEffect = Field(default=OverrideEffect.GRANT)
    reason: str | None = None
