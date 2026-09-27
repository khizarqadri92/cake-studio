"""organization and branches

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.drop_column("business_name")
        batch_op.drop_column("business_address")
        batch_op.drop_column("timezone")

    op.create_table(
        "organization",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_name", sa.String, nullable=False, server_default="Cake Studio"),
        sa.Column("legal_name", sa.String, nullable=True),
        sa.Column("registration_number", sa.String, nullable=True),
        sa.Column("tax_number", sa.String, nullable=True),
        sa.Column("business_type", sa.String, nullable=True),
        sa.Column("industry", sa.String, nullable=True),
        sa.Column("logo_url", sa.String, nullable=True),
        sa.Column("favicon_url", sa.String, nullable=True),
        sa.Column("address_line1", sa.String, nullable=True),
        sa.Column("address_line2", sa.String, nullable=True),
        sa.Column("city", sa.String, nullable=True),
        sa.Column("state", sa.String, nullable=True),
        sa.Column("country", sa.String, nullable=True),
        sa.Column("postal_code", sa.String, nullable=True),
        sa.Column("phone_primary", sa.String, nullable=True),
        sa.Column("phone_secondary", sa.String, nullable=True),
        sa.Column("email_primary", sa.String, nullable=True),
        sa.Column("email_secondary", sa.String, nullable=True),
        sa.Column("website_url", sa.String, nullable=True),
        sa.Column("business_hours", sa.JSON, nullable=False),
        sa.Column("timezone", sa.String, nullable=False, server_default="Asia/Karachi"),
        sa.Column("default_language", sa.String, nullable=False, server_default="en"),
        sa.Column("default_currency", sa.String, nullable=False, server_default="PKR"),
        sa.Column("date_format", sa.String, nullable=False, server_default="DD/MM/YYYY"),
        sa.Column("number_format", sa.String, nullable=False, server_default="1,234.56"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "branch",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("code", sa.String, nullable=False, unique=True),
        sa.Column("address_line1", sa.String, nullable=True),
        sa.Column("address_line2", sa.String, nullable=True),
        sa.Column("city", sa.String, nullable=True),
        sa.Column("state", sa.String, nullable=True),
        sa.Column("country", sa.String, nullable=True),
        sa.Column("postal_code", sa.String, nullable=True),
        sa.Column("phone", sa.String, nullable=True),
        sa.Column("email", sa.String, nullable=True),
        sa.Column("manager_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("business_hours", sa.JSON, nullable=False),
        sa.Column("timezone", sa.String, nullable=False, server_default="Asia/Karachi"),
        sa.Column("currency", sa.String, nullable=False, server_default="PKR"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("branch")
    op.drop_table("organization")
    with op.batch_alter_table("systemconfig") as batch_op:
        batch_op.add_column(sa.Column("business_name", sa.String, nullable=False, server_default="Cake Studio"))
        batch_op.add_column(sa.Column("business_address", sa.String, nullable=True))
        batch_op.add_column(sa.Column("timezone", sa.String, nullable=False, server_default="Asia/Karachi"))
