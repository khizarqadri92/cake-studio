"""choose system date or processing date

Revision ID: 0028
Revises: 0027
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing installs keep working exactly as before: processing date.
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.add_column(sa.Column("date_mode", sa.String, nullable=False, server_default="processing"))


def downgrade() -> None:
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.drop_column("date_mode")
