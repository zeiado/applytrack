"""create interviews table

Revision ID: 4fd6060b9f0d
Revises: 4ccbc9280e6d
Create Date: 2026-10-17 17:54:45.491395

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4fd6060b9f0d"
down_revision: str | Sequence[str] | None = "4ccbc9280e6d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "interviews",
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "phone_screen",
                "technical",
                "behavioral",
                "onsite",
                "other",
                name="interview_kind",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("interviewer", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "kind IN ('phone_screen', 'technical', 'behavioral', 'onsite', 'other')",
            name=op.f("ck_interviews_interview_kind"),
        ),
        sa.CheckConstraint(
            "duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440)",
            name=op.f("ck_interviews_duration_range"),
        ),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            name=op.f("fk_interviews_application_id_applications"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interviews")),
    )
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.create_index(
            "ix_interviews_application_id_scheduled_at",
            ["application_id", "scheduled_at"],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("interviews", schema=None) as batch_op:
        batch_op.drop_index("ix_interviews_application_id_scheduled_at")

    op.drop_table("interviews")
