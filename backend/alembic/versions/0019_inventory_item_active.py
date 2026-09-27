"""inventory item active flag

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-22

"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventoryitem",
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("inventoryitem", "is_active")
