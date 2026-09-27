"""organization time format

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organization",
        sa.Column("time_format", sa.String, nullable=False, server_default="hh:mm A"),
    )


def downgrade() -> None:
    op.drop_column("organization", "time_format")
