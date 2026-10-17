import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, UTCDateTime, utcnow
from applytrack.models.enums import ApplicationStatus


class StatusChange(Base):
    """One row per status change. Append-only: rows are never updated."""

    __tablename__ = "status_changes"
    __table_args__ = (Index("ix_status_changes_application_id_id", "application_id", "id"),)

    # Integer id gives a strict insertion order, even when two changes share a timestamp.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE")
    )
    from_status: Mapped[ApplicationStatus | None] = mapped_column(
        enum_column(ApplicationStatus, "status_change_from_status")
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(
        enum_column(ApplicationStatus, "status_change_to_status")
    )
    note: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
