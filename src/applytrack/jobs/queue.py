from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from applytrack.models import Job, JobStatus
from applytrack.repositories.jobs import JobRepository


def enqueue(
    session: Session,
    kind: str,
    payload: dict[str, Any],
    *,
    max_attempts: int,
    run_at: datetime | None = None,
) -> Job:
    """Add a job to the caller's transaction. It runs only if that transaction commits."""
    return JobRepository(session).add(
        Job(
            kind=kind,
            payload=payload,
            status=JobStatus.PENDING,
            attempts=0,
            max_attempts=max_attempts,
            run_at=run_at or datetime.now(UTC),
        )
    )
