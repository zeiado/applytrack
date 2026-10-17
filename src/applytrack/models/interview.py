import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin
from applytrack.models.enums import InterviewKind


class Interview(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "interviews"
    __table_args__ = (
        Index("ix_interviews_application_id_scheduled_at", "application_id", "scheduled_at"),
        CheckConstraint(
            "duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 1440)",
            name="duration_range",
        ),
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE")
    )
    scheduled_at: Mapped[datetime] = mapped_column(UTCDateTime)
    kind: Mapped[InterviewKind] = mapped_column(
        enum_column(InterviewKind, "interview_kind"), default=InterviewKind.OTHER
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    interviewer: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)
