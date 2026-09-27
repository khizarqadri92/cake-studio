"""units of measure and purchases

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "unitofmeasure",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("abbreviation", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "purchase",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("supplier.id"), nullable=True),
        sa.Column("invoice_number", sa.String, nullable=True),
        sa.Column("purchase_date", sa.Date, nullable=False),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("total_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("created_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "purchaseitem",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("purchase_id", UUID(as_uuid=True), sa.ForeignKey("purchase.id"), nullable=False),
        sa.Column("inventory_item_id", UUID(as_uuid=True), sa.ForeignKey("inventoryitem.id"), nullable=False),
        sa.Column("quantity", sa.Float, nullable=False),
        sa.Column("unit_price", sa.Float, nullable=False),
        sa.Column("line_total", sa.Float, nullable=False),
    )

    with op.batch_alter_table("inventoryitem") as batch_op:
        batch_op.alter_column("unit", existing_type=sa.String, nullable=True)
        batch_op.add_column(sa.Column("unit_id", UUID(as_uuid=True), sa.ForeignKey("unitofmeasure.id"), nullable=True))

    with op.batch_alter_table("stockmovement") as batch_op:
        batch_op.add_column(sa.Column("unit_price", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("purchase_id", UUID(as_uuid=True), sa.ForeignKey("purchase.id"), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("stockmovement") as batch_op:
        batch_op.drop_column("purchase_id")
        batch_op.drop_column("unit_price")

    with op.batch_alter_table("inventoryitem") as batch_op:
        batch_op.drop_column("unit_id")
        batch_op.alter_column("unit", existing_type=sa.String, nullable=False)

    op.drop_table("purchaseitem")
    op.drop_table("purchase")
    op.drop_table("unitofmeasure")
