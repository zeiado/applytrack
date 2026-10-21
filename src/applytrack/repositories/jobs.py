import uuid
from datetime import datetime

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from applytrack.models import Job, JobStatus


class JobRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, job: Job) -> Job:
        self.session.add(job)
        self.session.flush()
        return job

    def get(self, job_id: uuid.UUID) -> Job | None:
        return self.session.get(Job, job_id)

    def lock_next_due(self, now: datetime) -> Job | None:
        """Lock the oldest job that is due: pending and past run_at, or running with an
        expired claim (its worker died).

        SKIP LOCKED makes workers pass over rows another worker is claiming, so several
        workers never take the same job. (SQLite ignores the lock; it has one writer.)
        """
        return self.session.scalar(
            select(Job)
            .where(
                or_(
                    and_(Job.status == JobStatus.PENDING, Job.run_at <= now),
                    and_(Job.status == JobStatus.RUNNING, Job.locked_until <= now),
                )
            )
            .order_by(Job.run_at, Job.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )

    def delete_finished(self, status: JobStatus, before: datetime) -> int:
        result = self.session.execute(
            delete(Job).where(Job.status == status, Job.finished_at < before)
        )
        return int(getattr(result, "rowcount", 0))
