"""create cvs table

Revision ID: 5d2e8b1a9c47
Revises: c62d4730613c
Create Date: 2026-10-26 08:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5d2e8b1a9c47"
down_revision: str | Sequence[str] | None = "c62d4730613c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = ("uploading", "processing", "ready", "failed")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "cvs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                *STATUSES, name="cv_status", native_enum=False, create_constraint=False, length=20
            ),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("error", sa.String(length=40), nullable=True),
        sa.Column("replaces_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            f"status IN ({', '.join(repr(s) for s in STATUSES)})", name=op.f("ck_cvs_cv_status")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_cvs_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["replaces_id"], ["cvs.id"], name=op.f("fk_cvs_replaces_id_cvs"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cvs")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_cvs_storage_key")),
    )
    op.create_index(op.f("ix_cvs_user_id"), "cvs", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_cvs_user_id"), table_name="cvs")
    op.drop_table("cvs")
