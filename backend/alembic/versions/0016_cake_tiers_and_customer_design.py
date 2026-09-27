"""cake tiers catalog and customer design fields on order item

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caketier",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("price_modifier", sa.Float, nullable=False, server_default="0"),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    with op.batch_alter_table("orderitem") as batch_op:
        batch_op.add_column(sa.Column("cake_tier_id", UUID(as_uuid=True), sa.ForeignKey("caketier.id"), nullable=True))
        batch_op.add_column(sa.Column("is_customer_design", sa.Boolean, nullable=False, server_default="false"))
        batch_op.add_column(sa.Column("reference_image_url", sa.String, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("orderitem") as batch_op:
        batch_op.drop_column("reference_image_url")
        batch_op.drop_column("is_customer_design")
        batch_op.drop_column("cake_tier_id")
    op.drop_table("caketier")
