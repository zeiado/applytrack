"""index applications by user and follow_up_on

Revision ID: 5c9dbe5cd0df
Revises: 4fd6060b9f0d
Create Date: 2026-10-17 18:15:27.917437

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5c9dbe5cd0df"
down_revision: str | Sequence[str] | None = "4fd6060b9f0d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # New index first, then drop the old one, so the column is never unindexed.
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.create_index(
            "ix_applications_user_id_follow_up_on", ["user_id", "follow_up_on"], unique=False
        )
        batch_op.drop_index(batch_op.f("ix_applications_follow_up_on"))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_applications_follow_up_on"), ["follow_up_on"], unique=False
        )
        batch_op.drop_index("ix_applications_user_id_follow_up_on")
