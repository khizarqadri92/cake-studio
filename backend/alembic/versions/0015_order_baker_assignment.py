"""order baker assignment

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order", sa.Column("baker_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("order", "baker_staff_id")
