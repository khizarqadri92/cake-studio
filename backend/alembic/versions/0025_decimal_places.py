"""decimal places for amounts and quantities

Revision ID: 0025
Revises: 0024
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.add_column(sa.Column("amount_decimals", sa.Integer, nullable=False, server_default="2"))
        batch_op.add_column(sa.Column("quantity_decimals", sa.Integer, nullable=False, server_default="3"))


def downgrade() -> None:
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.drop_column("quantity_decimals")
        batch_op.drop_column("amount_decimals")
