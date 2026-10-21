"""add email verification

Revision ID: 06279daad81f
Revises: 4c3429a2d5c5
Create Date: 2026-10-21 04:46:51.683079

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "06279daad81f"
down_revision: str | Sequence[str] | None = "4c3429a2d5c5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "email_tokens",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum(
                "verify_email",
                "reset_password",
                name="email_token_purpose",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "purpose IN ('verify_email', 'reset_password')",
            name=op.f("ck_email_tokens_email_token_purpose"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_email_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_email_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_email_tokens_token_hash")),
    )
    with op.batch_alter_table("email_tokens", schema=None) as batch_op:
        batch_op.create_index(
            "ix_email_tokens_user_id_purpose_created_at",
            ["user_id", "purpose", "created_at"],
            unique=False,
        )

    # Existing users get English emails and start unverified.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("locale", sa.String(length=2), server_default="en", nullable=False)
        )
        batch_op.add_column(sa.Column("email_verified_at", sa.DateTime(timezone=True)))
        batch_op.create_check_constraint(op.f("ck_users_locale"), "locale IN ('ar', 'en')")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_constraint(op.f("ck_users_locale"), type_="check")
        batch_op.drop_column("email_verified_at")
        batch_op.drop_column("locale")

    with op.batch_alter_table("email_tokens", schema=None) as batch_op:
        batch_op.drop_index("ix_email_tokens_user_id_purpose_created_at")

    op.drop_table("email_tokens")
