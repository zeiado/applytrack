"""Runs queued jobs (docs/adr/0007-database-job-queue-and-email.md).

A job is claimed in one short transaction, run outside any transaction, then marked
done, scheduled for a retry, or failed in another. A worker that dies mid-job
leaves a claim that expires after ``lease``, and the job runs again.
"""

import logging
import threading
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.logging import request_id_var
from applytrack.models import Job, JobStatus
from applytrack.repositories.email_tokens import EmailTokenRepository
from applytrack.repositories.jobs import JobRepository
from applytrack.repositories.refresh_tokens import RefreshTokenRepository

logger = logging.getLogger("applytrack.jobs")


class PermanentJobError(Exception):
    """Retrying won't help (bad payload, address rejected): fail the job now."""


@dataclass(frozen=True)
class JobContext:
    job_id: uuid.UUID
    kind: str
    attempt: int
    max_attempts: int


class JobHandler(Protocol):
    def __call__(self, payload: dict[str, Any], job: JobContext) -> None: ...


@dataclass(frozen=True)
class RetryPolicy:
    """Exponential backoff: 30 s, 2 min, 8 min, 32 min, then hourly."""

    base: timedelta = timedelta(seconds=30)
    factor: int = 4
    maximum: timedelta = timedelta(hours=1)

    def delay(self, attempt: int) -> timedelta:
        delay: timedelta = self.base * self.factor ** (attempt - 1)
        return min(delay, self.maximum)


@dataclass(frozen=True)
class Retention:
    """How long finished jobs are kept before housekeeping deletes them."""

    done: timedelta = timedelta(days=7)
    failed: timedelta = timedelta(days=30)


def _utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class _Claimed:
    context: JobContext
    payload: dict[str, Any]
    runnable: bool = True  # False when the claim only recorded a lost job as failed


@dataclass
class Worker:
    session_factory: sessionmaker[Session]
    handlers: Mapping[str, JobHandler]
    clock: Callable[[], datetime] = _utcnow
    lease: timedelta = timedelta(minutes=5)
    retry: RetryPolicy = field(default_factory=RetryPolicy)
    retention: Retention = field(default_factory=Retention)
    housekeeping_every: timedelta = timedelta(hours=1)
    _last_housekeeping: datetime | None = field(default=None, init=False)

    def run_once(self) -> bool:
        """Run the next due job, if any. Returns whether there was one."""
        claimed = self._claim()
        if claimed is None:
            return False
        if not claimed.runnable:
            return True
        token = request_id_var.set(f"job-{claimed.context.job_id.hex[:12]}")
        try:
            self._execute(claimed)
        finally:
            request_id_var.reset(token)
        return True

    def run_pending(self, limit: int = 1000) -> int:
        """Run due jobs until none are left (or ``limit``). Returns how many ran."""
        count = 0
        while count < limit and self.run_once():
            count += 1
        return count

    def run_forever(self, stop: threading.Event, poll_seconds: float) -> None:
        """Process jobs until ``stop`` is set. Sleeps ``poll_seconds`` when idle."""
        logger.info("Worker started", extra={"job_kinds": sorted(self.handlers)})
        while not stop.is_set():
            try:
                self.maybe_housekeep()
                busy = self.run_once()
            except Exception:  # e.g. the database is unreachable; keep the loop alive
                logger.exception("Worker loop error; retrying shortly")
                stop.wait(min(poll_seconds * 5, 60))
                continue
            if not busy:
                stop.wait(poll_seconds)
        logger.info("Worker stopped")

    def maybe_housekeep(self) -> None:
        now = self.clock()
        if self._last_housekeeping and now - self._last_housekeeping < self.housekeeping_every:
            return
        self._last_housekeeping = now
        self.housekeep()

    def housekeep(self) -> None:
        """Delete old finished jobs, and expired refresh tokens and email links."""
        now = self.clock()
        with self.session_factory() as session:
            jobs = JobRepository(session)
            done = jobs.delete_finished(JobStatus.DONE, now - self.retention.done)
            failed = jobs.delete_finished(JobStatus.FAILED, now - self.retention.failed)
            tokens = RefreshTokenRepository(session).delete_expired(now)
            # Kept a day past expiry: the per-hour email limit counts recent ones.
            links = EmailTokenRepository(session).delete_expired(now - timedelta(days=1))
            session.commit()
        if done or failed or tokens or links:
            logger.info(
                "Housekeeping",
                extra={
                    "deleted_jobs": done + failed,
                    "deleted_refresh_tokens": tokens,
                    "deleted_email_tokens": links,
                },
            )

    def close(self) -> None:
        for handler in self.handlers.values():
            close = getattr(handler, "close", None)
            if callable(close):
                close()

    def _claim(self) -> _Claimed | None:
        now = self.clock()
        with self.session_factory() as session:
            job = JobRepository(session).lock_next_due(now)
            if job is None:
                return None
            context = JobContext(job.id, job.kind, job.attempts + 1, job.max_attempts)
            if job.attempts >= job.max_attempts:
                # Its last attempt's claim expired: the worker died running it.
                self._finish(job, JobStatus.FAILED, now, "Worker stopped during the last attempt")
                session.commit()
                logger.error("Job failed", extra=_log_fields(context, "worker_lost"))
                return _Claimed(context, {}, runnable=False)
            job.status = JobStatus.RUNNING
            job.attempts += 1
            job.locked_until = now + self.lease
            payload = dict(job.payload)
            session.commit()
        return _Claimed(context, payload)

    def _execute(self, claimed: _Claimed) -> None:
        context = claimed.context
        handler = self.handlers.get(context.kind)
        error: Exception | None = None
        try:
            if handler is None:
                raise PermanentJobError(f"No handler for job kind {context.kind!r}")
            handler(claimed.payload, context)
        except Exception as exc:  # recorded on the job; the loop must keep going
            error = exc

        now = self.clock()
        with self.session_factory() as session:
            job = JobRepository(session).get(context.job_id)
            if job is None or job.status != JobStatus.RUNNING or job.attempts != context.attempt:
                # Deleted, or our claim expired and another worker took over.
                logger.warning("Job changed while running", extra=_log_fields(context, "stale"))
                return
            if error is None:
                self._finish(job, JobStatus.DONE, now, None)
                outcome = "done"
            elif isinstance(error, PermanentJobError) or context.attempt >= context.max_attempts:
                self._finish(job, JobStatus.FAILED, now, _describe(error))
                outcome = "failed"
            else:
                job.status = JobStatus.PENDING
                job.locked_until = None
                job.run_at = now + self.retry.delay(context.attempt)
                job.last_error = _describe(error)
                outcome = "retry"
            session.commit()

        fields = _log_fields(context, outcome)
        if outcome == "done":
            logger.info("Job done", extra=fields)
        elif outcome == "retry":
            logger.warning("Job failed; will retry", extra={**fields, "error": _describe(error)})
        else:
            logger.error("Job failed", extra={**fields, "error": _describe(error)})

    @staticmethod
    def _finish(job: Job, status: JobStatus, now: datetime, error: str | None) -> None:
        job.status = status
        job.finished_at = now
        job.locked_until = None
        job.last_error = error
        job.payload = {}  # don't keep addresses or one-time links once finished


def _describe(error: BaseException | None) -> str:
    return f"{type(error).__name__}: {error}"[:2000]


def _log_fields(context: JobContext, outcome: str) -> dict[str, Any]:
    return {
        "job_id": str(context.job_id),
        "job_kind": context.kind,
        "attempt": context.attempt,
        "max_attempts": context.max_attempts,
        "outcome": outcome,
    }


class WorkerThread:
    """Runs a worker in a background thread of the API process (APPLYTRACK_RUN_WORKER_IN_API),
    for hosts where a separate worker process costs extra."""

    def __init__(self, worker: Worker, poll_seconds: float) -> None:
        self.worker = worker
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=worker.run_forever,
            args=(self._stop, poll_seconds),
            name="applytrack-worker",
            daemon=True,
        )

    def start(self) -> None:
        self._thread.start()

    def stop(self, timeout: float = 30) -> None:
        """Finish the current job, then stop."""
        self._stop.set()
        self._thread.join(timeout)
        self.worker.close()

    def is_alive(self) -> bool:
        return self._thread.is_alive()
