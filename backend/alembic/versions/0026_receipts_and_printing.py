"""receipts and kitchen-ticket printing

Revision ID: 0026
Revises: 0025
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.add_column(sa.Column("printer_mode", sa.String, nullable=False, server_default="browser"))
        batch_op.add_column(sa.Column("printer_host", sa.String, nullable=True))
        batch_op.add_column(sa.Column("printer_port", sa.Integer, nullable=False, server_default="9100"))
        batch_op.add_column(sa.Column("printer_width", sa.Integer, nullable=False, server_default="48"))
        batch_op.add_column(sa.Column("phone_country_code", sa.String, nullable=False, server_default="92"))

    with op.batch_alter_table("order") as batch_op:
        batch_op.add_column(sa.Column("business_date", sa.Date, nullable=True))
    # Existing orders: best available value is the date they were created.
    op.execute('''UPDATE "order" SET business_date = created_at::date WHERE business_date IS NULL''')

    op.create_table(
        "printjob",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False, index=True),
        sa.Column("kind", sa.String, nullable=False, server_default="kitchen_ticket"),
        sa.Column("reason", sa.String, nullable=False, server_default="confirmation"),
        sa.Column("mode", sa.String, nullable=False),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("error", sa.String, nullable=True),
        sa.Column("printer", sa.String, nullable=True),
        sa.Column("created_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("printjob")
    with op.batch_alter_table("order") as batch_op:
        batch_op.drop_column("business_date")
    with op.batch_alter_table("systemconfig") as batch_op:
        for col in ("phone_country_code", "printer_width", "printer_port", "printer_host", "printer_mode"):
            batch_op.drop_column(col)
