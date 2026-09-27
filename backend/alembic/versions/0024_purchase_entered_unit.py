"""purchases: remember the unit, quantity and price as entered

Revision ID: 0024
Revises: 0023
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("purchaseitem") as batch_op:
        batch_op.add_column(sa.Column("entered_quantity", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("entered_unit", sa.String, nullable=True))
        batch_op.add_column(sa.Column("entered_unit_price", sa.Float, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("purchaseitem") as batch_op:
        batch_op.drop_column("entered_unit_price")
        batch_op.drop_column("entered_unit")
        batch_op.drop_column("entered_quantity")
