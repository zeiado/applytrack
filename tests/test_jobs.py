"""The database job queue and worker (docs/adr/0007-database-job-queue-and-email.md)."""

import logging
import signal
import threading
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, sessionmaker

from applytrack import main as main_module
from applytrack import worker as worker_module
from applytrack.core.config import Settings
from applytrack.jobs.queue import enqueue
from applytrack.jobs.worker import (
    JobContext,
    PermanentJobError,
    RetryPolicy,
    Worker,
    WorkerThread,
)
from applytrack.mail.backends import EmailError, EmailMessage, MemoryEmailBackend
from applytrack.mail.mailer import SEND_EMAIL, Mailer
from applytrack.mail.templates import EmailTemplateError
from applytrack.models import Job, JobStatus, RefreshToken, User
from tests.conftest import TEST_DATABASE_URL


class Clock:
    def __init__(self) -> None:
        self.now = datetime.now(UTC) + timedelta(seconds=1)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, delta: timedelta) -> None:
        self.now += delta


@pytest.fixture
def clock(worker: Worker) -> Clock:
    clock = Clock()
    worker.clock = clock
    return clock


@pytest.fixture
def factory(app: FastAPI) -> sessionmaker[Session]:
    session_factory: sessionmaker[Session] = app.state.session_factory
    return session_factory


def queue_test_email(
    factory: sessionmaker[Session], settings: Settings, to: str = "ada@example.com"
) -> uuid.UUID:
    with factory() as session:
        job = Mailer(session, settings).send(
            to=to, template="test", locale="en", context={"sent_at": "today"}
        )
        session.commit()
        return job.id


def load(factory: sessionmaker[Session], job_id: uuid.UUID) -> Job:
    with factory() as session:
        job = session.get(Job, job_id)
        assert job is not None
        return job


class FlakyBackend(MemoryEmailBackend):
    """Fails with the given errors first, then sends."""

    def __init__(self, *errors: Exception) -> None:
        super().__init__()
        self.errors = list(errors)
        self.closed = False

    def send(self, message: EmailMessage) -> str | None:
        if self.errors:
            raise self.errors.pop(0)
        return super().send(message)

    def close(self) -> None:
        self.closed = True


def worker_with(
    backend: MemoryEmailBackend, settings: Settings, factory: sessionmaker[Session], clock: Clock
) -> Worker:
    worker = worker_module.build_worker(settings, factory, email_backend=backend)
    worker.clock = clock
    return worker


# ---- Queueing ----------------------------------------------------------------------


def test_queued_email_is_sent_by_the_worker(
    factory: sessionmaker[Session],
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    job_id = queue_test_email(factory, settings)
    assert mailbox.outbox == []  # queueing sends nothing

    assert worker.run_pending() == 1

    [email] = mailbox.outbox
    assert email.to == "ada@example.com"
    assert email.subject == "Sekka test email"
    assert email.sender == settings.email_from
    assert "sending email works" in email.text
    assert email.idempotency_key == f"applytrack-job-{job_id}"

    job = load(factory, job_id)
    assert job.status == JobStatus.DONE
    assert job.attempts == 1
    assert job.finished_at == clock.now
    assert job.payload == {}  # the address and any links are gone once sent


def test_email_is_not_sent_if_the_transaction_rolls_back(
    factory: sessionmaker[Session], settings: Settings, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    with factory() as session:
        Mailer(session, settings).send(
            to="ada@example.com", template="test", locale="en", context={"sent_at": "now"}
        )
        session.rollback()

    assert worker.run_pending() == 0
    assert mailbox.outbox == []


def test_mailer_rejects_bad_templates_in_the_request(
    factory: sessionmaker[Session], settings: Settings
) -> None:
    with factory() as session:
        mailer = Mailer(session, settings)
        with pytest.raises(EmailTemplateError):
            mailer.send(to="ada@example.com", template="nope", locale="en")
        with pytest.raises(EmailTemplateError):  # missing sent_at
            mailer.send(to="ada@example.com", template="test", locale="ar")


def test_jobs_wait_for_run_at(
    factory: sessionmaker[Session], settings: Settings, worker: Worker, clock: Clock
) -> None:
    with factory() as session:
        job = enqueue(
            session,
            SEND_EMAIL,
            {},
            max_attempts=3,
            run_at=clock.now + timedelta(minutes=10),
        )
        session.commit()

    assert worker.run_once() is False
    clock.advance(timedelta(minutes=10))
    assert worker.run_once() is True
    assert load(factory, job.id).status == JobStatus.FAILED  # empty payload: permanent


def test_jobs_run_oldest_first(
    factory: sessionmaker[Session],
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    queue_test_email(factory, settings, "first@example.com")
    queue_test_email(factory, settings, "second@example.com")

    worker.run_pending()

    assert [m.to for m in mailbox.outbox] == ["first@example.com", "second@example.com"]


# ---- Failures and retries ----------------------------------------------------------


def test_temporary_failures_retry_with_backoff_then_succeed(
    factory: sessionmaker[Session], settings: Settings, clock: Clock
) -> None:
    backend = FlakyBackend(
        EmailError("Resend returned 503", permanent=False),
        EmailError("Resend unreachable: ConnectTimeout", permanent=False),
    )
    worker = worker_with(backend, settings, factory, clock)
    job_id = queue_test_email(factory, settings)

    assert worker.run_pending() == 1  # only the first attempt is due
    job = load(factory, job_id)
    assert job.status == JobStatus.PENDING
    assert job.attempts == 1
    assert job.run_at == clock.now + timedelta(seconds=30)
    assert job.last_error == "EmailError: Resend returned 503"
    assert job.payload != {}  # still needed for the retry

    clock.advance(timedelta(seconds=30))
    assert worker.run_pending() == 1
    assert load(factory, job_id).run_at == clock.now + timedelta(minutes=2)

    clock.advance(timedelta(minutes=2))
    worker.run_pending()
    job = load(factory, job_id)
    assert job.status == JobStatus.DONE
    assert job.attempts == 3
    assert job.last_error is None
    assert len(backend.outbox) == 1


def test_job_fails_after_its_last_attempt(
    factory: sessionmaker[Session], settings: Settings, clock: Clock
) -> None:
    settings.job_max_attempts = 2
    backend = FlakyBackend(*[EmailError("timeout", permanent=False)] * 5)
    worker = worker_with(backend, settings, factory, clock)
    job_id = queue_test_email(factory, settings)

    worker.run_pending()
    clock.advance(timedelta(hours=1))
    worker.run_pending()

    job = load(factory, job_id)
    assert job.status == JobStatus.FAILED
    assert job.attempts == 2
    assert job.last_error == "EmailError: timeout"
    assert job.payload == {}
    clock.advance(timedelta(days=1))
    assert worker.run_pending() == 0


def test_permanent_failure_is_not_retried(
    factory: sessionmaker[Session],
    settings: Settings,
    clock: Clock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    backend = FlakyBackend(EmailError("Resend returned 422: invalid `to`", permanent=True))
    worker = worker_with(backend, settings, factory, clock)
    job_id = queue_test_email(factory, settings)

    with caplog.at_level(logging.ERROR, logger="applytrack.jobs"):
        worker.run_pending()

    job = load(factory, job_id)
    assert job.status == JobStatus.FAILED
    assert job.attempts == 1
    assert job.last_error is not None
    assert "invalid `to`" in job.last_error
    [record] = caplog.records
    assert record.__dict__["outcome"] == "failed"
    assert record.__dict__["job_id"] == str(job_id)


def test_unexpected_handler_errors_are_retried(
    factory: sessionmaker[Session], settings: Settings, clock: Clock
) -> None:
    backend = FlakyBackend(RuntimeError("boom"))
    worker = worker_with(backend, settings, factory, clock)
    job_id = queue_test_email(factory, settings)

    worker.run_pending()

    job = load(factory, job_id)
    assert job.status == JobStatus.PENDING
    assert job.last_error == "RuntimeError: boom"


@pytest.mark.parametrize(
    ("kind", "payload", "error"),
    [
        ("no_such_job", {}, "No handler for job kind 'no_such_job'"),
        (SEND_EMAIL, {"to": "not-an-email"}, "Can't build the email"),
        (
            SEND_EMAIL,
            {"to": "ada@example.com", "template": "test", "locale": "en", "context": {}},
            "Can't build the email",  # missing sent_at
        ),
    ],
)
def test_jobs_that_cannot_run_fail_immediately(
    factory: sessionmaker[Session],
    worker: Worker,
    clock: Clock,
    kind: str,
    payload: dict[str, Any],
    error: str,
) -> None:
    with factory() as session:
        job = enqueue(session, kind, payload, max_attempts=5)
        session.commit()

    worker.run_pending()

    failed = load(factory, job.id)
    assert failed.status == JobStatus.FAILED
    assert failed.last_error is not None
    assert error in failed.last_error


def test_retry_policy_caps_the_delay() -> None:
    policy = RetryPolicy()
    delays = [policy.delay(attempt) for attempt in range(1, 7)]
    assert delays == [
        timedelta(seconds=30),
        timedelta(minutes=2),
        timedelta(minutes=8),
        timedelta(minutes=32),
        timedelta(hours=1),
        timedelta(hours=1),
    ]


# ---- Crashed workers ---------------------------------------------------------------


def claim_and_crash(factory: sessionmaker[Session], job_id: uuid.UUID, clock: Clock) -> None:
    """What a worker that dies mid-job leaves behind: a running job with a claim."""
    with factory() as session:
        job = session.get(Job, job_id)
        assert job is not None
        job.status = JobStatus.RUNNING
        job.attempts += 1
        job.locked_until = clock.now + timedelta(minutes=5)
        session.commit()


def test_job_of_a_crashed_worker_runs_again_after_the_lease(
    factory: sessionmaker[Session],
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    job_id = queue_test_email(factory, settings)
    claim_and_crash(factory, job_id, clock)

    assert worker.run_pending() == 0  # still claimed
    clock.advance(timedelta(minutes=5))
    assert worker.run_pending() == 1

    job = load(factory, job_id)
    assert job.status == JobStatus.DONE
    assert job.attempts == 2
    assert len(mailbox.outbox) == 1


def test_crash_on_the_last_attempt_fails_the_job(
    factory: sessionmaker[Session],
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    settings.job_max_attempts = 1
    job_id = queue_test_email(factory, settings)
    claim_and_crash(factory, job_id, clock)
    clock.advance(timedelta(minutes=5))

    assert worker.run_once() is True

    job = load(factory, job_id)
    assert job.status == JobStatus.FAILED
    assert job.last_error == "Worker stopped during the last attempt"
    assert mailbox.outbox == []


def test_result_is_dropped_if_the_job_changed_while_running(
    factory: sessionmaker[Session], settings: Settings, clock: Clock
) -> None:
    """A slow handler whose lease expired: another worker took the job, so the slow
    one must not overwrite that worker's result."""

    class DeletingBackend(MemoryEmailBackend):
        def send(self, message: EmailMessage) -> str | None:
            with factory() as session:
                session.execute(delete(Job))
                session.commit()
            return super().send(message)

    worker = worker_with(DeletingBackend(), settings, factory, clock)
    queue_test_email(factory, settings)

    assert worker.run_once() is True  # no error, just a warning


# ---- Housekeeping ------------------------------------------------------------------


def test_housekeeping_deletes_old_jobs_and_expired_refresh_tokens(
    factory: sessionmaker[Session], worker: Worker, clock: Clock
) -> None:
    now = clock.now
    with factory() as session:
        user = User(email="ada@example.com", password_hash="x")
        session.add(user)
        session.flush()

        def job(status: JobStatus, finished_days_ago: int) -> Job:
            finished = now - timedelta(days=finished_days_ago)
            return Job(
                kind="k",
                payload={},
                status=status,
                max_attempts=1,
                run_at=finished,
                finished_at=finished,
            )

        def token(expires_in: timedelta) -> RefreshToken:
            return RefreshToken(
                user_id=user.id,
                family_id=uuid.uuid4(),
                token_hash=uuid.uuid4().hex * 2,
                expires_at=now + expires_in,
            )

        session.add_all(
            [
                job(JobStatus.DONE, 8),  # deleted
                job(JobStatus.DONE, 6),
                job(JobStatus.FAILED, 31),  # deleted
                job(JobStatus.FAILED, 29),
                Job(kind="k", payload={}, status=JobStatus.PENDING, max_attempts=1, run_at=now),
                token(timedelta(seconds=-1)),  # deleted
                token(timedelta(days=1)),
            ]
        )
        session.commit()

    worker.housekeep()

    with factory() as session:
        left = sorted(str(s) for s in session.scalars(select(Job.status)))
        tokens = session.scalars(select(RefreshToken)).all()
    assert left == ["done", "failed", "pending"]
    assert len(tokens) == 1
    assert tokens[0].expires_at > now


def test_housekeeping_runs_at_most_hourly(worker: Worker, clock: Clock) -> None:
    calls: list[datetime] = []
    worker.housekeep = lambda: calls.append(clock.now)  # type: ignore[method-assign]

    worker.maybe_housekeep()
    clock.advance(timedelta(minutes=59))
    worker.maybe_housekeep()
    clock.advance(timedelta(minutes=1))
    worker.maybe_housekeep()

    assert len(calls) == 2


# ---- Running the loop --------------------------------------------------------------


def test_run_forever_processes_jobs_until_stopped(
    factory: sessionmaker[Session],
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    queue_test_email(factory, settings)
    stop = threading.Event()
    waits: list[float | None] = []

    def wait(timeout: float | None = None) -> bool:  # the first idle wait ends the loop
        waits.append(timeout)
        stop.set()
        return True

    stop.wait = wait  # type: ignore[method-assign]
    worker.run_forever(stop, poll_seconds=2)

    assert len(mailbox.outbox) == 1
    assert waits == [2]


def test_run_forever_survives_errors(
    worker: Worker, clock: Clock, caplog: pytest.LogCaptureFixture
) -> None:
    def broken() -> bool:
        raise ConnectionError("database unreachable")

    worker.run_once = broken  # type: ignore[method-assign]
    stop = threading.Event()
    waits: list[float | None] = []

    def wait(timeout: float | None = None) -> bool:
        waits.append(timeout)
        stop.set()
        return True

    stop.wait = wait  # type: ignore[method-assign]
    with caplog.at_level(logging.ERROR, logger="applytrack.jobs"):
        worker.run_forever(stop, poll_seconds=2)

    assert waits == [10]  # backs off longer than a normal poll
    assert "Worker loop error" in caplog.text


def test_worker_thread_starts_and_stops(settings: Settings, factory: sessionmaker[Session]) -> None:
    backend = FlakyBackend()
    worker = worker_module.build_worker(settings, factory, email_backend=backend)
    runner = WorkerThread(worker, poll_seconds=0.01)

    runner.start()
    assert runner.is_alive()
    runner.stop(timeout=5)

    assert not runner.is_alive()
    assert backend.closed  # connections released


class FakeWorkerThread:
    instances: list["FakeWorkerThread"]

    def __init__(self, worker: Worker, poll_seconds: float) -> None:
        self.worker = worker
        self.events: list[str] = []
        FakeWorkerThread.instances.append(self)

    def start(self) -> None:
        self.events.append("start")

    def stop(self) -> None:
        self.events.append("stop")


@pytest.fixture
def fake_worker_thread(monkeypatch: pytest.MonkeyPatch) -> Iterator[type[FakeWorkerThread]]:
    FakeWorkerThread.instances = []
    monkeypatch.setattr(main_module, "WorkerThread", FakeWorkerThread)
    yield FakeWorkerThread


@pytest.mark.parametrize("enabled", [True, False])
def test_api_runs_the_worker_only_when_configured(
    settings: Settings, fake_worker_thread: type[FakeWorkerThread], enabled: bool
) -> None:
    settings.run_worker_in_api = enabled
    app = main_module.create_app(settings)

    with TestClient(app):
        pass

    if enabled:
        [thread] = fake_worker_thread.instances
        assert thread.events == ["start", "stop"]
    else:
        assert fake_worker_thread.instances == []


def test_production_warns_when_emails_are_only_logged(
    settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    production = settings.model_copy(update={"environment": "production"})
    with caplog.at_level(logging.WARNING, logger="applytrack.jobs"):
        worker_module.warn_if_emails_only_logged(settings)
        assert caplog.records == []
        worker_module.warn_if_emails_only_logged(production)
    assert "written to the log, not sent" in caplog.text


def test_worker_process_stops_on_a_signal(
    monkeypatch: pytest.MonkeyPatch, settings: Settings
) -> None:
    handlers: dict[int, Any] = {}
    ran: list[float] = []
    closed: list[bool] = []

    def fake_run_forever(self: Worker, stop: threading.Event, poll_seconds: float) -> None:
        ran.append(poll_seconds)
        for handler in handlers.values():
            handler(15, None)  # what SIGTERM from the platform would do
        assert stop.is_set()

    monkeypatch.setattr(worker_module, "get_settings", lambda: settings)
    monkeypatch.setattr(worker_module, "configure_logging", lambda **_: None)
    monkeypatch.setattr(signal, "signal", lambda sig, h: handlers.update({sig: h}))
    monkeypatch.setattr(Worker, "run_forever", fake_run_forever)
    monkeypatch.setattr(Worker, "close", lambda self: closed.append(True))

    worker_module.main()

    assert ran == [settings.worker_poll_seconds]
    assert len(handlers) == 2
    assert closed == [True]


def test_handlers_receive_the_attempt_number(factory: sessionmaker[Session], clock: Clock) -> None:
    seen: list[JobContext] = []

    def handler(payload: dict[str, Any], job: JobContext) -> None:
        seen.append(job)
        if job.attempt == 1:
            raise TimeoutError
        if payload != {"n": 1}:
            raise PermanentJobError("bad payload")

    worker = Worker(factory, {"count": handler}, clock=clock)
    with factory() as session:
        job = enqueue(session, "count", {"n": 1}, max_attempts=3)
        session.commit()

    worker.run_pending()
    clock.advance(timedelta(minutes=1))
    worker.run_pending()

    assert [(c.attempt, c.max_attempts, c.kind) for c in seen] == [(1, 3, "count"), (2, 3, "count")]
    assert load(factory, job.id).status == JobStatus.DONE
    worker.close()  # plain functions have nothing to close


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="SKIP LOCKED needs PostgreSQL",
)
def test_two_workers_never_claim_the_same_job(
    factory: sessionmaker[Session], settings: Settings
) -> None:
    from applytrack.repositories.jobs import JobRepository

    first_id = queue_test_email(factory, settings, "one@example.com")
    second_id = queue_test_email(factory, settings, "two@example.com")
    now = datetime.now(UTC) + timedelta(seconds=1)

    with factory() as a, factory() as b:
        claimed_by_a = JobRepository(a).lock_next_due(now)
        claimed_by_b = JobRepository(b).lock_next_due(now)  # a still holds its lock
        assert claimed_by_a is not None
        assert claimed_by_b is not None
        assert {claimed_by_a.id, claimed_by_b.id} == {first_id, second_id}
        a.rollback()
        b.rollback()
