"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- auth / permissions foundation ---
    op.create_table(
        "staff",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("email", sa.String, nullable=False, unique=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "role",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
    )

    op.create_table(
        "staffrole",
        sa.Column("staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), primary_key=True),
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("role.id"), primary_key=True),
    )

    op.create_table(
        "permission",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
    )

    op.create_table(
        "rolepermission",
        sa.Column("role_id", UUID(as_uuid=True), sa.ForeignKey("role.id"), primary_key=True),
        sa.Column("permission_id", UUID(as_uuid=True), sa.ForeignKey("permission.id"), primary_key=True),
    )

    op.create_table(
        "staffpermissionoverride",
        sa.Column("staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), primary_key=True),
        sa.Column("permission_id", UUID(as_uuid=True), sa.ForeignKey("permission.id"), primary_key=True),
        sa.Column("effect", sa.String, nullable=False, server_default="grant"),
        sa.Column("reason", sa.String, nullable=True),
    )

    # --- system setup / processing date ---
    op.create_table(
        "systemconfig",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("business_name", sa.String, nullable=False, server_default="Cake Studio"),
        sa.Column("business_address", sa.String, nullable=True),
        sa.Column("current_processing_date", sa.Date, nullable=False),
        sa.Column("fiscal_year_start_month", sa.Integer, nullable=False, server_default="1"),
        sa.Column("is_day_locked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("timezone", sa.String, nullable=False, server_default="Asia/Karachi"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "processingdatelog",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("old_date", sa.Date, nullable=False),
        sa.Column("new_date", sa.Date, nullable=False),
        sa.Column("changed_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("reason", sa.String, nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
    )

    # --- orders (models exist now, endpoints come in a later phase) ---
    op.create_table(
        "order",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_name", sa.String, nullable=False),
        sa.Column("customer_phone", sa.String, nullable=True),
        sa.Column("processing_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("status", sa.String, nullable=False, server_default="received"),
        sa.Column("created_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "orderitem",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False),
        sa.Column("cake_flavor", sa.String, nullable=False),
        sa.Column("size", sa.String, nullable=False),
        sa.Column("tiers", sa.Integer, nullable=False, server_default="1"),
        sa.Column("custom_message", sa.String, nullable=True),
        sa.Column("reference_image_url", sa.String, nullable=True),
        sa.Column("unit_price", sa.Float, nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
    )

    # --- inventory ---
    op.create_table(
        "supplier",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("contact_phone", sa.String, nullable=True),
    )

    op.create_table(
        "inventoryitem",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("unit", sa.String, nullable=False),
        sa.Column("qty_on_hand", sa.Float, nullable=False, server_default="0"),
        sa.Column("reorder_threshold", sa.Float, nullable=False, server_default="0"),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("supplier.id"), nullable=True),
    )

    op.create_table(
        "stockmovement",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("inventory_item_id", UUID(as_uuid=True), sa.ForeignKey("inventoryitem.id"), nullable=False),
        sa.Column("qty_delta", sa.Float, nullable=False),
        sa.Column("reason", sa.String, nullable=False),
        sa.Column("processing_date", sa.Date, nullable=False),
        sa.Column("created_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "recipe",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False),
    )

    op.create_table(
        "recipeitem",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("recipe_id", UUID(as_uuid=True), sa.ForeignKey("recipe.id"), nullable=False),
        sa.Column("inventory_item_id", UUID(as_uuid=True), sa.ForeignKey("inventoryitem.id"), nullable=False),
        sa.Column("qty_required", sa.Float, nullable=False),
    )

    # --- accounting ---
    op.create_table(
        "invoice",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("processing_date", sa.Date, nullable=False),
        sa.Column("is_paid", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "payment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoice.id"), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("method", sa.String, nullable=False),
        sa.Column("processing_date", sa.Date, nullable=False),
        sa.Column("received_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
    )

    op.create_table(
        "expense",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("category", sa.String, nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("processing_date", sa.Date, nullable=False),
        sa.Column("recorded_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("expense")
    op.drop_table("payment")
    op.drop_table("invoice")
    op.drop_table("recipeitem")
    op.drop_table("recipe")
    op.drop_table("stockmovement")
    op.drop_table("inventoryitem")
    op.drop_table("supplier")
    op.drop_table("orderitem")
    op.drop_table("order")
    op.drop_table("processingdatelog")
    op.drop_table("systemconfig")
    op.drop_table("staffpermissionoverride")
    op.drop_table("rolepermission")
    op.drop_table("permission")
    op.drop_table("staffrole")
    op.drop_table("role")
    op.drop_table("staff")
