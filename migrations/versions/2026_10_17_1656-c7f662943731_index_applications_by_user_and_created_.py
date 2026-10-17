"""index applications by user and created_at

Revision ID: c7f662943731
Revises: c9319babdabe
Create Date: 2026-10-17 16:56:34.723983

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7f662943731"
down_revision: str | Sequence[str] | None = "c9319babdabe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create the new index before dropping the old one, so user_id lookups are never unindexed.
    # (On a large production table this would be CREATE INDEX CONCURRENTLY outside a transaction.)
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.create_index(
            "ix_applications_user_id_created_at", ["user_id", "created_at"], unique=False
        )
        batch_op.drop_index(batch_op.f("ix_applications_user_id"))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_applications_user_id"), ["user_id"], unique=False)
        batch_op.drop_index("ix_applications_user_id_created_at")
