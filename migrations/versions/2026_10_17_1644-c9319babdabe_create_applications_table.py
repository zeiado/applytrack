"""create applications table

Revision ID: c9319babdabe
Revises: 7c1aca61beb0
Create Date: 2026-10-17 16:44:54.083852

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9319babdabe"
down_revision: str | Sequence[str] | None = "7c1aca61beb0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "applications",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company", sa.String(length=200), nullable=False),
        sa.Column("role_title", sa.String(length=200), nullable=False),
        sa.Column("job_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "source",
            sa.Enum(
                "referral",
                "job_board",
                "company_site",
                "recruiter",
                "other",
                name="application_source",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "wishlist",
                "applied",
                "screening",
                "interviewing",
                "offer",
                "accepted",
                "rejected",
                "withdrawn",
                name="application_status",
                native_enum=False,
                create_constraint=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("applied_on", sa.Date(), nullable=True),
        sa.Column("follow_up_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "source IN ('referral', 'job_board', 'company_site', 'recruiter', 'other')",
            name=op.f("ck_applications_application_source"),
        ),
        sa.CheckConstraint(
            "status IN ('wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn')",
            name=op.f("ck_applications_application_status"),
        ),
        sa.CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
            name=op.f("ck_applications_salary_range"),
        ),
        sa.CheckConstraint(
            "salary_min IS NULL OR salary_min >= 0",
            name=op.f("ck_applications_salary_min_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_applications_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_applications")),
    )
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_applications_follow_up_on"), ["follow_up_on"], unique=False
        )
        batch_op.create_index(batch_op.f("ix_applications_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_applications_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("applications", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_applications_user_id"))
        batch_op.drop_index(batch_op.f("ix_applications_status"))
        batch_op.drop_index(batch_op.f("ix_applications_follow_up_on"))

    op.drop_table("applications")
