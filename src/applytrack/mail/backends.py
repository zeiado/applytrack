"""Where emails go: the log (console), a list (tests), Resend, or any SMTP provider.

Every backend has the same ``send`` method, so switching providers is a settings
change (APPLYTRACK_EMAIL_BACKEND), not a code change.
"""

import logging
import smtplib
import ssl
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from email.message import EmailMessage as MimeMessage
from email.utils import formatdate, make_msgid, parseaddr
from typing import Any, Literal, Protocol

import httpx

from applytrack import __version__
from applytrack.core.config import Settings

logger = logging.getLogger("applytrack.mail")


@dataclass(frozen=True)
class EmailMessage:
    sender: str
    to: str
    subject: str
    text: str
    html: str
    reply_to: str | None = None
    # Lets a provider drop a duplicate when a job is retried after the email was sent.
    idempotency_key: str | None = None
    # Extra headers, e.g. List-Unsubscribe on reminder emails.
    headers: Mapping[str, str] = field(default_factory=dict)


class EmailError(Exception):
    """Sending failed. ``permanent`` errors won't succeed if retried (a rejected
    address, a bad request); the rest (timeouts, rate limits, outages) may."""

    def __init__(self, message: str, *, permanent: bool) -> None:
        super().__init__(message)
        self.permanent = permanent


class EmailBackend(Protocol):
    def send(self, message: EmailMessage) -> str | None:
        """Send one email. Returns the provider's message id, if it gives one."""

    def close(self) -> None:
        """Release connections."""


def mask_email(address: str) -> str:
    """``a***@example.com``: enough to trace a delivery in the logs, not the full address."""
    local, _, domain = address.partition("@")
    return f"{local[:1]}***@{domain}"


class ConsoleEmailBackend:
    """Writes each email to the log instead of sending it. For development, and for
    deployments that have no sending domain yet."""

    def send(self, message: EmailMessage) -> str | None:
        logger.info(
            "Email not sent (console backend)\nTo: %s\nSubject: %s\n\n%s",
            message.to,
            message.subject,
            message.text,
        )
        return None

    def close(self) -> None:
        pass


class MemoryEmailBackend:
    """Keeps sent emails in ``outbox``. For tests."""

    def __init__(self) -> None:
        self.outbox: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> str | None:
        self.outbox.append(message)
        return f"memory-{len(self.outbox)}"

    def close(self) -> None:
        pass


class ResendEmailBackend:
    """Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)."""

    url = "https://api.resend.com/emails"

    def __init__(self, api_key: str, *, timeout: float, client: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._client = client or httpx.Client(timeout=timeout)

    def send(self, message: EmailMessage) -> str | None:
        body: dict[str, Any] = {
            "from": message.sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        }
        if message.reply_to:
            body["reply_to"] = message.reply_to
        if message.headers:
            body["headers"] = dict(message.headers)
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "User-Agent": f"applytrack/{__version__}",
        }
        if message.idempotency_key:
            headers["Idempotency-Key"] = message.idempotency_key

        try:
            response = self._client.post(self.url, json=body, headers=headers)
        except httpx.HTTPError as exc:  # timeouts, DNS, refused connections
            raise EmailError(f"Resend unreachable: {type(exc).__name__}", permanent=False) from exc

        if response.is_success:
            message_id = _json_field(response, "id")
            return message_id or None
        detail = _json_field(response, "message") or response.reason_phrase
        transient = response.status_code == 429 or response.status_code >= 500
        raise EmailError(
            f"Resend returned {response.status_code}: {detail[:200]}", permanent=not transient
        )

    def close(self) -> None:
        self._client.close()


def _json_field(response: httpx.Response, field: str) -> str:
    try:
        value = response.json().get(field)
    except (ValueError, AttributeError):
        return ""
    return value if isinstance(value, str) else ""


SmtpFactory = Callable[..., smtplib.SMTP]


class SmtpEmailBackend:
    """Any provider that speaks SMTP: Postmark, Brevo, Amazon SES, Mailgun, Gmail…"""

    def __init__(
        self,
        host: str,
        port: int,
        *,
        username: str | None,
        password: str | None,
        security: Literal["starttls", "tls", "none"],
        timeout: float,
        smtp: SmtpFactory = smtplib.SMTP,
        smtp_ssl: SmtpFactory = smtplib.SMTP_SSL,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.security = security
        self.timeout = timeout
        self._smtp = smtp
        self._smtp_ssl = smtp_ssl

    def send(self, message: EmailMessage) -> str | None:
        mime = _to_mime(message)
        try:
            if self.security == "tls":
                connection = self._smtp_ssl(
                    self.host, self.port, timeout=self.timeout, context=ssl.create_default_context()
                )
            else:
                connection = self._smtp(self.host, self.port, timeout=self.timeout)
            with connection:
                if self.security == "starttls":
                    connection.starttls(context=ssl.create_default_context())
                if self.username:
                    connection.login(self.username, self.password or "")
                connection.send_message(mime)
        except smtplib.SMTPRecipientsRefused as exc:
            codes = [code for code, _ in exc.recipients.values()]
            permanent = all(500 <= code < 600 for code in codes)
            raise EmailError(f"SMTP refused the recipient: {codes}", permanent=permanent) from exc
        except smtplib.SMTPResponseException as exc:
            # 5xx is a final answer (bad address, auth failed); 4xx asks us to try later.
            permanent = 500 <= exc.smtp_code < 600
            raise EmailError(f"SMTP error {exc.smtp_code}", permanent=permanent) from exc
        except (smtplib.SMTPException, OSError) as exc:  # disconnects, timeouts, DNS
            raise EmailError(f"SMTP unreachable: {type(exc).__name__}", permanent=False) from exc
        return str(mime["Message-ID"])

    def close(self) -> None:
        pass  # one connection per email, closed after sending


def _to_mime(message: EmailMessage) -> MimeMessage:
    mime = MimeMessage()
    mime["From"] = message.sender
    mime["To"] = message.to
    mime["Subject"] = message.subject
    mime["Date"] = formatdate(localtime=False)
    _, sender_address = parseaddr(message.sender)
    mime["Message-ID"] = make_msgid(domain=sender_address.partition("@")[2] or None)
    if message.reply_to:
        mime["Reply-To"] = message.reply_to
    for name, value in message.headers.items():
        mime[name] = value
    mime.set_content(message.text)
    mime.add_alternative(message.html, subtype="html")
    return mime


def build_email_backend(settings: Settings) -> EmailBackend:
    """The backend APPLYTRACK_EMAIL_BACKEND selects. Settings already checked it is complete."""
    if settings.email_backend == "resend":
        assert settings.resend_api_key is not None  # noqa: S101 (checked by Settings)
        return ResendEmailBackend(
            settings.resend_api_key.get_secret_value(), timeout=settings.email_timeout_seconds
        )
    if settings.email_backend == "smtp":
        assert settings.smtp_host is not None  # noqa: S101 (checked by Settings)
        return SmtpEmailBackend(
            settings.smtp_host,
            settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password.get_secret_value() if settings.smtp_password else None,
            security=settings.smtp_security,
            timeout=settings.email_timeout_seconds,
        )
    return ConsoleEmailBackend()
