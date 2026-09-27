"""business date on ingredient usage, for reports

Revision ID: 0027
Revises: 0026
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orderingredientusage") as batch_op:
        batch_op.add_column(sa.Column("processing_date", sa.Date, nullable=True))
    # Existing rows: the date they were recorded is the best available value
    op.execute("UPDATE orderingredientusage SET processing_date = recorded_at::date WHERE processing_date IS NULL")


def downgrade() -> None:
    with op.batch_alter_table("orderingredientusage") as batch_op:
        batch_op.drop_column("processing_date")
