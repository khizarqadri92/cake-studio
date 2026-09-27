"""rider delivery queue: start delivery, mark delivered, cash pending

Revision ID: 0022
Revises: 0021
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("order") as batch_op:
        batch_op.add_column(sa.Column("delivery_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("rider_amount_collected", sa.Float, nullable=True))

    # Under the old flow, assigning a rider went straight to OUT_FOR_DELIVERY,
    # so those orders count as already on the road.
    op.execute(
        """UPDATE "order" SET delivery_started_at = assigned_rider_at
           WHERE LOWER(status) = 'out_for_delivery' AND delivery_started_at IS NULL"""
    )


def downgrade() -> None:
    with op.batch_alter_table("order") as batch_op:
        batch_op.drop_column("rider_amount_collected")
        batch_op.drop_column("delivered_at")
        batch_op.drop_column("delivery_started_at")
