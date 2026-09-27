"""order taking system - customers, real order/orderitem shape

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # invoice/payment were empty phase-1 stubs with no endpoints ever built
    # against them - dropping so Payment Management can design them properly
    # once it's actually built, informed by this real order shape.
    op.drop_table("payment")
    op.drop_table("invoice")
    op.drop_table("orderitem")
    op.drop_table("order")

    op.create_table(
        "customer",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String, nullable=False),
        sa.Column("phone", sa.String, nullable=False, unique=True),
        sa.Column("email", sa.String, nullable=True),
        sa.Column("address_line1", sa.String, nullable=True),
        sa.Column("city", sa.String, nullable=True),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "order",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_number", sa.String, nullable=False, unique=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customer.id"), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branch.id"), nullable=True),
        sa.Column("status", sa.String, nullable=False, server_default="draft"),
        sa.Column("fulfillment_type", sa.String, nullable=False, server_default="pickup"),
        sa.Column("delivery_zone_id", UUID(as_uuid=True), sa.ForeignKey("deliveryzone.id"), nullable=True),
        sa.Column("delivery_address", sa.String, nullable=True),
        sa.Column("delivery_date", sa.Date, nullable=False),
        sa.Column("delivery_time", sa.String, nullable=True),
        sa.Column("subtotal", sa.Float, nullable=False, server_default="0"),
        sa.Column("delivery_charge", sa.Float, nullable=False, server_default="0"),
        sa.Column("discount", sa.Float, nullable=False, server_default="0"),
        sa.Column("total", sa.Float, nullable=False, server_default="0"),
        sa.Column("advance_paid", sa.Float, nullable=False, server_default="0"),
        sa.Column("notes", sa.String, nullable=True),
        sa.Column("created_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("sent_to_baker_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_to_baker_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True),
    )

    op.create_table(
        "orderitem",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("order.id"), nullable=False),
        sa.Column("cake_flavor_id", UUID(as_uuid=True), sa.ForeignKey("cakeflavor.id"), nullable=True),
        sa.Column("cake_filling_id", UUID(as_uuid=True), sa.ForeignKey("cakefilling.id"), nullable=True),
        sa.Column("cake_frosting_id", UUID(as_uuid=True), sa.ForeignKey("cakefrosting.id"), nullable=True),
        sa.Column("cake_shape_id", UUID(as_uuid=True), sa.ForeignKey("cakeshape.id"), nullable=True),
        sa.Column("cake_size_id", UUID(as_uuid=True), sa.ForeignKey("cakesize.id"), nullable=True),
        sa.Column("theme_id", UUID(as_uuid=True), sa.ForeignKey("theme.id"), nullable=True),
        sa.Column("cake_box_id", UUID(as_uuid=True), sa.ForeignKey("cakebox.id"), nullable=True),
        sa.Column("custom_message", sa.String, nullable=True),
        sa.Column("special_instructions", sa.String, nullable=True),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float, nullable=False, server_default="0"),
        sa.Column("line_total", sa.Float, nullable=False, server_default="0"),
    )

    op.create_table(
        "orderitemaddon",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_item_id", UUID(as_uuid=True), sa.ForeignKey("orderitem.id"), nullable=False),
        sa.Column("addon_id", UUID(as_uuid=True), sa.ForeignKey("cakeaddon.id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Float, nullable=False, server_default="0"),
    )

    op.create_table(
        "ordersequence",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("next_number", sa.Integer, nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("ordersequence")
    op.drop_table("orderitemaddon")
    op.drop_table("orderitem")
    op.drop_table("order")
    op.drop_table("customer")
