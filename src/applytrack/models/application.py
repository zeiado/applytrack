import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from applytrack.models.enums import ApplicationSource, ApplicationStatus


def enum_column(enum_cls: type[StrEnum], name: str) -> Enum:
    # Stored as VARCHAR + CHECK constraint instead of a native PostgreSQL ENUM,
    # so adding a value later is a simple migration (see ADR 0004).
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=20,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class Application(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
            name="salary_range",
        ),
        CheckConstraint("salary_min IS NULL OR salary_min >= 0", name="salary_min_non_negative"),
        # Serves the default list query (one user's rows, newest first) and any lookup
        # by user_id alone, so a separate user_id index isn't needed.
        Index("ix_applications_user_id_created_at", "user_id", "created_at"),
        # Serves the due-reminders query: one user's rows with follow_up_on <= a date.
        Index("ix_applications_user_id_follow_up_on", "user_id", "follow_up_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    company: Mapped[str] = mapped_column(String(200))
    role_title: Mapped[str] = mapped_column(String(200))
    job_url: Mapped[str | None] = mapped_column(String(2048))
    source: Mapped[ApplicationSource] = mapped_column(
        enum_column(ApplicationSource, "application_source"), default=ApplicationSource.OTHER
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        enum_column(ApplicationStatus, "application_status"),
        default=ApplicationStatus.APPLIED,
        index=True,
    )
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    applied_on: Mapped[date | None] = mapped_column(Date)
    follow_up_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    # Plain text, up to 20,000 characters. Loaded only when read: lists don't need it.
    job_description: Mapped[str | None] = mapped_column(Text, deferred=True)
