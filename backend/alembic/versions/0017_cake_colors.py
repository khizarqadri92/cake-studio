"""cake colors

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cakecolor",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("price_modifier", sa.Float, nullable=False, server_default="0"),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "orderitem",
        sa.Column("cake_color_id", UUID(as_uuid=True), sa.ForeignKey("cakecolor.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orderitem", "cake_color_id")
    op.drop_table("cakecolor")
