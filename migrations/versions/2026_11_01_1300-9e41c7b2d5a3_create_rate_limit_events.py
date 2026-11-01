"""create rate_limit_events table

Revision ID: 9e41c7b2d5a3
Revises: 3cbbd38fda87
Create Date: 2026-11-01 13:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9e41c7b2d5a3"
down_revision: str | Sequence[str] | None = "3cbbd38fda87"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "rate_limit_events",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("limiter", sa.String(length=40), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("at", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rate_limit_events")),
    )
    with op.batch_alter_table("rate_limit_events", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_rate_limit_events_at"), ["at"], unique=False)
        batch_op.create_index(
            "ix_rate_limit_events_limiter_key_at", ["limiter", "key_hash", "at"], unique=False
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("rate_limit_events")
