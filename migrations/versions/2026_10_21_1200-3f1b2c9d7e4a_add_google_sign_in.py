"""add google sign-in

Revision ID: 3f1b2c9d7e4a
Revises: d878842138c2
Create Date: 2026-10-21 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f1b2c9d7e4a"
down_revision: str | Sequence[str] | None = "d878842138c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("google_subject", sa.String(length=255)))
        batch_op.create_unique_constraint(batch_op.f("uq_users_google_subject"), ["google_subject"])
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    without_password = conn.scalar(
        sa.text("SELECT count(*) FROM users WHERE password_hash IS NULL")
    )
    if without_password:
        raise RuntimeError(
            f"{without_password} users sign in only with Google. They'd be locked out; "
            "have them set a password (forgot-password) before downgrading."
        )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
        batch_op.drop_constraint(batch_op.f("uq_users_google_subject"), type_="unique")
        batch_op.drop_column("google_subject")
