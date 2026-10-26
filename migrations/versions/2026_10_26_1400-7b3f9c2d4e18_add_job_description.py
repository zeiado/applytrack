"""add job description to applications

Revision ID: 7b3f9c2d4e18
Revises: 5d2e8b1a9c47
Create Date: 2026-10-26 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7b3f9c2d4e18"
down_revision: str | Sequence[str] | None = "5d2e8b1a9c47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable, no default: instant on PostgreSQL however many rows there are.
    op.add_column("applications", sa.Column("job_description", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("applications", "job_description")
