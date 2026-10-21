from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, UTCDateTime, UUIDPrimaryKeyMixin, utcnow
from applytrack.models.enums import JobStatus


class Job(UUIDPrimaryKeyMixin, Base):
    """A unit of background work, such as one email (docs/adr/0007).

    Jobs are rows in the same database as everything else, so a job is saved in the
    same transaction as the change that caused it: both are committed, or neither.
    """

    __tablename__ = "jobs"
    __table_args__ = (
        # Serves the worker's "next due job" query.
        Index("ix_jobs_status_run_at", "status", "run_at"),
    )

    kind: Mapped[str] = mapped_column(String(64))
    # Cleared when the job finishes, so finished jobs don't keep emails and links around.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    status: Mapped[JobStatus] = mapped_column(
        enum_column(JobStatus, "job_status"), default=JobStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer)
    run_at: Mapped[datetime] = mapped_column(UTCDateTime)
    # While running: when the worker's claim expires. After that, another worker may
    # take the job (the first one crashed or hung).
    locked_until: Mapped[datetime | None] = mapped_column(UTCDateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
