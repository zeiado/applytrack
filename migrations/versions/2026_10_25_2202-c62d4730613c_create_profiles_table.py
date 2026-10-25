"""create profiles table

Revision ID: c62d4730613c
Revises: 8a4e1f7c2b90
Create Date: 2026-10-25 22:02:18.860835

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c62d4730613c"
down_revision: str | Sequence[str] | None = "8a4e1f7c2b90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEVELS = ("student", "graduate", "junior", "mid", "senior")
VISIBILITIES = ("private", "recruiters")


def _in(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "profiles",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("headline", sa.String(length=160), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("education", sa.String(length=300), nullable=True),
        sa.Column(
            "experience_level",
            sa.Enum(
                *LEVELS,
                name="experience_level",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=True,
        ),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum(
                *VISIBILITIES,
                name="profile_visibility",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            server_default="private",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            _in("experience_level", LEVELS), name=op.f("ck_profiles_experience_level")
        ),
        sa.CheckConstraint(
            _in("visibility", VISIBILITIES), name=op.f("ck_profiles_profile_visibility")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_profiles_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_profiles")),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("profiles")
