"""add reminder email settings

Revision ID: d878842138c2
Revises: 666c291cc9da
Create Date: 2026-10-21 05:54:11.749070

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d878842138c2"
down_revision: str | Sequence[str] | None = "666c291cc9da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Existing users: Cairo time, reminder emails on (sent only once their email is verified).
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "timezone", sa.String(length=64), server_default="Africa/Cairo", nullable=False
            )
        )
        batch_op.add_column(
            sa.Column("reminder_emails", sa.Boolean(), server_default=sa.true(), nullable=False)
        )
        batch_op.add_column(sa.Column("reminders_checked_on", sa.Date()))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("reminders_checked_on")
        batch_op.drop_column("reminder_emails")
        batch_op.drop_column("timezone")
