"""The background worker process: ``python -m applytrack.worker``.

Runs queued jobs until it gets SIGINT or SIGTERM, then finishes the current job and
exits. See docs/adr/0007-database-job-queue-and-email.md.
"""

import logging
import signal
import threading

from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.config import Settings, get_settings, resolved_log_format
from applytrack.core.logging import configure_logging
from applytrack.db.session import build_engine, build_session_factory
from applytrack.jobs.worker import JobHandler, Worker
from applytrack.mail.backends import EmailBackend, build_email_backend
from applytrack.mail.mailer import SEND_EMAIL, SendEmailHandler
from applytrack.mail.templates import get_renderer

logger = logging.getLogger("applytrack.jobs")


def build_worker(
    settings: Settings,
    session_factory: sessionmaker[Session],
    *,
    email_backend: EmailBackend | None = None,
) -> Worker:
    """A worker with every job handler. Tests pass their own email backend."""
    handlers: dict[str, JobHandler] = {
        SEND_EMAIL: SendEmailHandler(
            email_backend or build_email_backend(settings),
            get_renderer(settings.app_name),
            settings,
        ),
    }
    return Worker(session_factory, handlers)


def warn_if_emails_only_logged(settings: Settings) -> None:
    if settings.environment == "production" and settings.email_backend == "console":
        logger.warning("APPLYTRACK_EMAIL_BACKEND=console: emails are written to the log, not sent")


def main() -> None:
    settings = get_settings()
    configure_logging(level=settings.log_level, log_format=resolved_log_format(settings))
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
