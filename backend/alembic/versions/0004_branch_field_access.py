"""branch field access

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "branchfieldaccess",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("role.id"), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branch.id"), nullable=False),
        sa.Column("section_key", sa.String, nullable=False),
        sa.Column("field_key", sa.String, nullable=False),
        sa.Column("access_level", sa.String, nullable=False, server_default="disable"),
        sa.UniqueConstraint("role_id", "branch_id", "section_key", "field_key", name="uq_role_branch_section_field"),
    )


def downgrade() -> None:
    op.drop_table("branchfieldaccess")
