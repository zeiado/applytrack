"""add stage_since to applications

Revision ID: 3cbbd38fda87
Revises: 7b3f9c2d4e18
Create Date: 2026-11-01 11:00:00.000000

"""

from collections.abc import Sequence
from datetime import UTC, date, datetime, time

import sqlalchemy as sa
from alembic import op

from applytrack.models.base import UTCDateTime

# revision identifiers, used by Alembic.
revision: str = "3cbbd38fda87"
down_revision: str | Sequence[str] | None = "7b3f9c2d4e18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

applications = sa.table(
    "applications",
    sa.column("id", sa.Uuid()),
    sa.column("status", sa.String()),
    sa.column("applied_on", sa.Date()),
    sa.column("created_at", UTCDateTime()),
    sa.column("stage_since", UTCDateTime()),
)
status_changes = sa.table(
    "status_changes",
    sa.column("application_id", sa.Uuid()),
    sa.column("changed_at", UTCDateTime()),
)


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "applications", sa.Column("stage_since", sa.DateTime(timezone=True), nullable=True)
    )

    # The latest move, or when it was added.
    latest_move = (
        sa.select(sa.func.max(status_changes.c.changed_at))
        .where(status_changes.c.application_id == applications.c.id)
        .scalar_subquery()
    )
    op.execute(
        applications.update().values(
            stage_since=sa.func.coalesce(latest_move, applications.c.created_at)
        )
    )

    # Still in the status it was added with, as "applied", with an earlier applied_on:
    # waiting since that day (the same rule as ApplicationService.first_stage_since).
    moves = (
        sa.select(sa.func.count())
        .select_from(status_changes)
        .where(status_changes.c.application_id == applications.c.id)
        .scalar_subquery()
    )
    bind = op.get_bind()
    rows = bind.execute(
        sa.select(applications.c.id, applications.c.applied_on, applications.c.stage_since).where(
            applications.c.status == "applied",
            applications.c.applied_on.is_not(None),
            moves <= 1,
        )
    ).all()
    for row in rows:
        applied_on: date = row.applied_on
        applied = datetime.combine(applied_on, time(), tzinfo=UTC)
        if applied < row.stage_since:
            bind.execute(
                applications.update().where(applications.c.id == row.id).values(stage_since=applied)
            )

    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.alter_column(
            "stage_since", existing_type=sa.DateTime(timezone=True), nullable=False
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.drop_column("stage_since")
