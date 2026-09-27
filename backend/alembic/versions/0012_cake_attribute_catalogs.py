"""cake attribute catalogs

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def _named_catalog_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("price_modifier", sa.Float, nullable=False, server_default="0"),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )


def upgrade() -> None:
    _named_catalog_table("cakeflavor")
    _named_catalog_table("cakefilling")
    _named_catalog_table("cakefrosting")
    _named_catalog_table("cakeshape")

    op.create_table(
        "cakesize",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("servings", sa.Integer, nullable=True),
        sa.Column("price_modifier", sa.Float, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "theme",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "cakeaddon",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("price", sa.Float, nullable=False, server_default="0"),
        sa.Column("max_qty", sa.Integer, nullable=False, server_default="1"),
        sa.Column("image_url", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("cakeaddon")
    op.drop_table("theme")
    op.drop_table("cakesize")
    op.drop_table("cakeshape")
    op.drop_table("cakefrosting")
    op.drop_table("cakefilling")
    op.drop_table("cakeflavor")
