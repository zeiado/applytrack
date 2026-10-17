"""create status_changes table

Revision ID: 4ccbc9280e6d
Revises: c7f662943731
Create Date: 2026-10-17 17:19:49.180173

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4ccbc9280e6d"
down_revision: str | Sequence[str] | None = "c7f662943731"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "status_changes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column(
            "from_status",
            sa.Enum(
                "wishlist",
                "applied",
                "screening",
                "interviewing",
                "offer",
                "accepted",
                "rejected",
                "withdrawn",
                name="status_change_from_status",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=True,
        ),
        sa.Column(
            "to_status",
            sa.Enum(
                "wishlist",
                "applied",
                "screening",
                "interviewing",
                "offer",
                "accepted",
                "rejected",
                "withdrawn",
                name="status_change_to_status",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "from_status IN ('wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn')",
            name=op.f("ck_status_changes_status_change_from_status"),
        ),
        sa.CheckConstraint(
            "to_status IN ('wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn')",
            name=op.f("ck_status_changes_status_change_to_status"),
        ),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            name=op.f("fk_status_changes_application_id_applications"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_status_changes")),
    )
    with op.batch_alter_table("status_changes", schema=None) as batch_op:
        batch_op.create_index(
            "ix_status_changes_application_id_id", ["application_id", "id"], unique=False
        )

    # Data migration: applications created before this table existed get one history
    # row for their current status, so every application has a history.
    op.execute(
        """
        INSERT INTO status_changes (application_id, from_status, to_status, changed_at)
        SELECT id, NULL, status, created_at FROM applications ORDER BY created_at, id
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("status_changes", schema=None) as batch_op:
        batch_op.drop_index("ix_status_changes_application_id_id")

    op.drop_table("status_changes")
