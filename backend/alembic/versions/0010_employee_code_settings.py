"""employee code settings

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "employeecodesettings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("prefix", sa.String, nullable=False, server_default="EMP"),
        sa.Column("separator", sa.String, nullable=False, server_default="-"),
        sa.Column("padding", sa.Integer, nullable=False, server_default="4"),
        sa.Column("include_year", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("next_sequence", sa.Integer, nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("employeecodesettings")
