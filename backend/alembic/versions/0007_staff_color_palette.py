"""staff color palette preference

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staff", sa.Column("color_palette", sa.String, nullable=True))


def downgrade() -> None:
    op.drop_column("staff", "color_palette")
