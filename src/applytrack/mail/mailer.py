"""Queueing emails (in the request) and sending them (in the worker)."""

import logging
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, ValidationError
from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.jobs.queue import enqueue
from applytrack.jobs.worker import JobContext, PermanentJobError
from applytrack.mail.backends import EmailBackend, EmailError, EmailMessage, mask_email
from applytrack.mail.templates import EmailRenderer, EmailTemplateError, Locale, get_renderer
from applytrack.models import Job

logger = logging.getLogger("applytrack.mail")

SEND_EMAIL = "send_email"

# Template variables: plain values, or a list of rows (e.g. applications in a reminder).
ContextValue = str | int | list[dict[str, str | int]]


class SendEmailPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to: EmailStr
    template: str
    locale: Locale
    context: dict[str, ContextValue]
    headers: dict[str, str] = {}


class Mailer:
    """What application code uses to send email.

    ``send`` only queues the email in the caller's transaction; the worker sends it.
    So a request never waits for the provider, and an email goes out only if the
    change that caused it was committed.
    """

    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    def send(
        self,
        *,
        to: str,
        template: str,
        locale: Locale,
        context: Mapping[str, ContextValue] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Job:
        payload = SendEmailPayload(
            to=to,
            template=template,
            locale=locale,
            context=dict(context or {}),
            headers=dict(headers or {}),
        )
        # Render once now, so a missing template or variable fails in the request that
        # caused it (and its test), not later in the worker.
        get_renderer(self.settings.app_name, self.settings.public_app_url).render(
            template, locale, payload.context
        )
        return enqueue(
            self.session,
            SEND_EMAIL,
            payload.model_dump(mode="json"),
            max_attempts=self.settings.job_max_attempts,
        )


class SendEmailHandler:
    """The worker's handler for ``send_email`` jobs."""

    def __init__(self, backend: EmailBackend, renderer: EmailRenderer, settings: Settings) -> None:
        self.backend = backend
        self.renderer = renderer
        self.settings = settings

    def __call__(self, payload: dict[str, Any], job: JobContext) -> None:
        try:
            email = SendEmailPayload.model_validate(payload)
            rendered = self.renderer.render(email.template, email.locale, email.context)
        except (ValidationError, EmailTemplateError) as exc:
            raise PermanentJobError(f"Can't build the email: {exc}") from exc

        message = EmailMessage(
            sender=self.settings.email_from,
            to=email.to,
            subject=rendered.subject,
            text=rendered.text,
            html=rendered.html,
            reply_to=self.settings.email_reply_to,
            idempotency_key=f"applytrack-job-{job.job_id}",
            headers=email.headers,
        )
        try:
            provider_id = self.backend.send(message)
        except EmailError as exc:
            if exc.permanent:
                raise PermanentJobError(str(exc)) from exc
            raise
        logger.info(
            "Email handed to the %s backend",
            self.settings.email_backend,
            extra={
                "template": email.template,
                "locale": email.locale,
                "to": mask_email(email.to),
                "provider_message_id": provider_id,
            },
        )

    def close(self) -> None:
        self.backend.close()
