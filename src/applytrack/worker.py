"""The background worker process: ``python -m applytrack.worker``.

Runs queued jobs until it gets SIGINT or SIGTERM, then finishes the current job and
exits. See docs/adr/0007-database-job-queue-and-email.md.
"""

import logging
import signal
import threading
from datetime import timedelta

from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.config import Settings, get_settings, resolved_log_format
from applytrack.core.logging import configure_logging
from applytrack.core.observability import init_error_tracking
from applytrack.db.session import build_engine, build_session_factory
from applytrack.jobs.worker import JobHandler, PeriodicTask, Worker
from applytrack.mail.backends import EmailBackend, build_email_backend
from applytrack.mail.mailer import SEND_EMAIL, SendEmailHandler
from applytrack.mail.templates import get_renderer
from applytrack.services.cvs import (
    DELETE_STORED_FILE,
    EXTRACT_CV_TEXT,
    AbandonedUploadCleaner,
    DeleteStoredFileHandler,
    ExtractCVTextHandler,
)
from applytrack.services.reminder_emails import ReminderEmailScheduler
from applytrack.storage import ObjectStorage, build_storage

logger = logging.getLogger("applytrack.jobs")


def build_worker(
    settings: Settings,
    session_factory: sessionmaker[Session],
    *,
    email_backend: EmailBackend | None = None,
    storage: ObjectStorage | None = None,
) -> Worker:
    """A worker with every job handler. Tests pass their own email backend and storage."""
    storage = storage or build_storage(settings)
    handlers: dict[str, JobHandler] = {
        SEND_EMAIL: SendEmailHandler(
            email_backend or build_email_backend(settings),
            get_renderer(settings.app_name, settings.public_app_url),
            settings,
        ),
    }
    if storage is not None:
        handlers[EXTRACT_CV_TEXT] = ExtractCVTextHandler(session_factory, storage)
        handlers[DELETE_STORED_FILE] = DeleteStoredFileHandler(storage)
    reminders = ReminderEmailScheduler(session_factory, settings)
    periodic = [
        PeriodicTask(
            "follow_up_reminders",
            timedelta(minutes=settings.reminder_check_minutes),
            reminders.run,
        ),
        PeriodicTask(
            "abandoned_uploads",
            timedelta(hours=1),
            AbandonedUploadCleaner(session_factory).run,
        ),
    ]
    return Worker(session_factory, handlers, periodic=periodic)


def warn_if_emails_only_logged(settings: Settings) -> None:
    if settings.environment == "production" and settings.email_backend == "console":
        logger.warning("APPLYTRACK_EMAIL_BACKEND=console: emails are written to the log, not sent")


def main() -> None:
    settings = get_settings()
    configure_logging(level=settings.log_level, log_format=resolved_log_format(settings))
    init_error_tracking(settings, component="worker")
    warn_if_emails_only_logged(settings)
    engine = build_engine(settings.database_url, echo=settings.database_echo)
    worker = build_worker(settings, build_session_factory(engine))

    stop = threading.Event()

    def request_stop(signum: int, _: object) -> None:
        logger.info("Stopping after the current job", extra={"signal": signum})
        stop.set()

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    try:
        worker.run_forever(stop, settings.worker_poll_seconds)
    finally:
        worker.close()
        engine.dispose()


if __name__ == "__main__":  # pragma: no cover
    main()
