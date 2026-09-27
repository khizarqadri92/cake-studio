"""staff profile fields and branch assignment

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("staff") as batch_op:
        batch_op.add_column(sa.Column("phone", sa.String, nullable=True))
        batch_op.add_column(sa.Column("job_title", sa.String, nullable=True))
        batch_op.add_column(sa.Column("employee_code", sa.String, nullable=True))
        batch_op.add_column(sa.Column("date_of_joining", sa.Date, nullable=True))
        batch_op.add_column(
            sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branch.id"), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("staff") as batch_op:
        batch_op.drop_column("branch_id")
        batch_op.drop_column("date_of_joining")
        batch_op.drop_column("employee_code")
        batch_op.drop_column("job_title")
        batch_op.drop_column("phone")
