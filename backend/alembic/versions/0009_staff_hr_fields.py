"""additional staff HR profile fields

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("staff") as batch_op:
        batch_op.add_column(sa.Column("department", sa.String, nullable=True))
        batch_op.add_column(sa.Column("date_of_birth", sa.Date, nullable=True))
        batch_op.add_column(sa.Column("gender", sa.String, nullable=True))
        batch_op.add_column(sa.Column("national_id", sa.String, nullable=True))
        batch_op.add_column(sa.Column("employment_type", sa.String, nullable=True))
        batch_op.add_column(sa.Column("basic_salary", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("address_line1", sa.String, nullable=True))
        batch_op.add_column(sa.Column("city", sa.String, nullable=True))
        batch_op.add_column(sa.Column("country", sa.String, nullable=True))
        batch_op.add_column(sa.Column("emergency_contact_name", sa.String, nullable=True))
        batch_op.add_column(sa.Column("emergency_contact_phone", sa.String, nullable=True))

    op.create_unique_constraint("uq_staff_employee_code", "staff", ["employee_code"])


def downgrade() -> None:
    op.drop_constraint("uq_staff_employee_code", "staff", type_="unique")
    with op.batch_alter_table("staff") as batch_op:
        batch_op.drop_column("emergency_contact_phone")
        batch_op.drop_column("emergency_contact_name")
        batch_op.drop_column("country")
        batch_op.drop_column("city")
        batch_op.drop_column("address_line1")
        batch_op.drop_column("basic_salary")
        batch_op.drop_column("employment_type")
        batch_op.drop_column("national_id")
        batch_op.drop_column("gender")
        batch_op.drop_column("date_of_birth")
        batch_op.drop_column("department")
