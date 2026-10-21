"""add refresh_tokens rotated_at

Revision ID: 8a4e1f7c2b90
Revises: 3f1b2c9d7e4a
Create Date: 2026-10-21 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8a4e1f7c2b90"
down_revision: str | Sequence[str] | None = "3f1b2c9d7e4a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("refresh_tokens", schema=None) as batch_op:
        batch_op.add_column(sa.Column("rotated_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("refresh_tokens", schema=None) as batch_op:
        batch_op.drop_column("rotated_at")
