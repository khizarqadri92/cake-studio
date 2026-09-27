"""baker accept / decline of an assigned order

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("order") as batch_op:
        batch_op.add_column(sa.Column("baker_accepted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("decline_reason", sa.String, nullable=True))
        batch_op.add_column(sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("declined_by_staff_id", UUID(as_uuid=True), sa.ForeignKey("staff.id"), nullable=True))

    # Orders already past the baker stage before this feature existed are
    # treated as accepted, so in-flight work isn't blocked by the new step.
    op.execute(
        """UPDATE "order" SET baker_accepted_at = COALESCE(production_started_at, sent_to_baker_at, NOW())
           WHERE LOWER(status) IN ('in_production', 'ready', 'out_for_delivery', 'completed')"""
    )


def downgrade() -> None:
    with op.batch_alter_table("order") as batch_op:
        batch_op.drop_column("declined_by_staff_id")
        batch_op.drop_column("declined_at")
        batch_op.drop_column("decline_reason")
        batch_op.drop_column("baker_accepted_at")
