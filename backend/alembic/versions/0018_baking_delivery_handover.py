"""baking, delivery, and handover workflow

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("order") as batch_op:
        batch_op.add_column(sa.Column("production_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("rider_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True))
        batch_op.add_column(sa.Column("assigned_rider_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("amount_received", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("handover_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("handover_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True))

    op.create_table(
        "orderingredientusage",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False),
        sa.Column("inventory_item_id", UUID(as_uuid=True), sa.ForeignKey("inventoryitem.id"), nullable=False),
        sa.Column("quantity_used", sa.Float, nullable=False),
        sa.Column("recorded_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("orderingredientusage")
    with op.batch_alter_table("order") as batch_op:
        batch_op.drop_column("handover_by_staff_id")
        batch_op.drop_column("handover_at")
        batch_op.drop_column("amount_received")
        batch_op.drop_column("assigned_rider_at")
        batch_op.drop_column("rider_staff_id")
        batch_op.drop_column("ready_at")
        batch_op.drop_column("production_started_at")
