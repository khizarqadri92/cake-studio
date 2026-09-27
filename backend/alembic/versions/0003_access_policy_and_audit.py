"""access policy, login history, audit trail, staff security fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("staff") as batch_op:
        batch_op.add_column(sa.Column("failed_login_attempts", sa.Integer, nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("password_updated_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("totp_secret", sa.String, nullable=True))
        batch_op.add_column(sa.Column("totp_enabled", sa.Boolean, nullable=False, server_default="false"))

    op.execute("UPDATE staff SET password_updated_at = created_at WHERE password_updated_at IS NULL")
    with op.batch_alter_table("staff") as batch_op:
        batch_op.alter_column("password_updated_at", nullable=False)

    op.create_table(
        "accesspolicy",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("default_role_id", UUID(as_uuid=True), sa.ForeignKey("role.id"), nullable=True),
        sa.Column("password_min_length", sa.Integer, nullable=False, server_default="8"),
        sa.Column("password_require_uppercase", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("password_require_number", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("password_require_symbol", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("password_expiry_days", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_login_attempts", sa.Integer, nullable=False, server_default="5"),
        sa.Column("lockout_duration_minutes", sa.Integer, nullable=False, server_default="15"),
        sa.Column("session_timeout_minutes", sa.Integer, nullable=False, server_default="480"),
        sa.Column("two_factor_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("ip_allowlist", sa.String, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "loginhistory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("attempted_email", sa.String, nullable=False),
        sa.Column("staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("failure_reason", sa.String, nullable=True),
        sa.Column("ip_address", sa.String, nullable=True),
        sa.Column("user_agent", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "auditlog",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("target_type", sa.String, nullable=True),
        sa.Column("target_id", sa.String, nullable=True),
        sa.Column("details", sa.JSON, nullable=True),
        sa.Column("ip_address", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("auditlog")
    op.drop_table("loginhistory")
    op.drop_table("accesspolicy")
    with op.batch_alter_table("staff") as batch_op:
        batch_op.drop_column("totp_enabled")
        batch_op.drop_column("totp_secret")
        batch_op.drop_column("password_updated_at")
        batch_op.drop_column("locked_until")
        batch_op.drop_column("failed_login_attempts")
