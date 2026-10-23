"""Email backends: console, memory, Resend (HTTP) and SMTP. No real network is used."""

import json
import logging
import smtplib
from dataclasses import replace
from email.message import EmailMessage as MimeMessage
from typing import Any, ClassVar

import httpx
import pytest
from pydantic import SecretStr

from applytrack.core.config import Settings
from applytrack.mail import __main__ as send_test
from applytrack.mail.backends import (
    ConsoleEmailBackend,
    EmailError,
    EmailMessage,
    MemoryEmailBackend,
    ResendEmailBackend,
    SmtpEmailBackend,
    build_email_backend,
    mask_email,
)

MESSAGE = EmailMessage(
    sender="ApplyTrack <noreply@applytrack.app>",
    to="ada@example.com",
    subject="Hello",
    text="Plain body\n",
    html="<p>HTML body</p>",
    reply_to="support@applytrack.app",
    idempotency_key="applytrack-job-123",
)


def test_mask_email() -> None:
    assert mask_email("ada@example.com") == "a***@example.com"
    assert mask_email("x") == "x***@"


def test_console_backend_logs_the_email(caplog: pytest.LogCaptureFixture) -> None:
    backend = ConsoleEmailBackend()
    with caplog.at_level(logging.INFO, logger="applytrack.mail"):
        assert backend.send(MESSAGE) is None
    backend.close()
    assert "To: ada@example.com" in caplog.text
    assert "Subject: Hello" in caplog.text
    assert "Plain body" in caplog.text


def test_memory_backend_keeps_emails() -> None:
    backend = MemoryEmailBackend()
    assert backend.send(MESSAGE) == "memory-1"
    backend.close()
    assert backend.outbox == [MESSAGE]


# ---- Resend ------------------------------------------------------------------------


def resend(handler: Any) -> ResendEmailBackend:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    return ResendEmailBackend("re_test_key", timeout=5, client=client)


def test_resend_sends_the_email() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "4ef9a417-02e9"})

    backend = resend(handler)
    assert backend.send(MESSAGE) == "4ef9a417-02e9"
    backend.close()

    [request] = seen
    assert str(request.url) == "https://api.resend.com/emails"
    assert request.headers["Authorization"] == "Bearer re_test_key"
    assert request.headers["Idempotency-Key"] == "applytrack-job-123"
    assert request.headers["User-Agent"].startswith("applytrack/")
    assert json.loads(request.content) == {
        "from": "ApplyTrack <noreply@applytrack.app>",
        "to": ["ada@example.com"],
        "subject": "Hello",
        "text": "Plain body\n",
        "html": "<p>HTML body</p>",
        "reply_to": "support@applytrack.app",
    }


def test_resend_without_reply_to_or_idempotency_key() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, text="not json")

    message = EmailMessage(sender="a@b.co", to="c@d.co", subject="s", text="t", html="h")
    assert resend(handler).send(message) is None
    assert "Idempotency-Key" not in seen[0].headers
    assert "reply_to" not in json.loads(seen[0].content)


@pytest.mark.parametrize(
    ("status", "body", "permanent", "detail"),
    [
        (422, {"message": "Invalid `to` field"}, True, "Resend returned 422: Invalid `to` field"),
        (403, {"message": "Domain not verified"}, True, "Resend returned 403: Domain not verified"),
        (401, None, True, "Resend returned 401: Unauthorized"),
        (429, {"message": "Too many requests"}, False, "Resend returned 429: Too many requests"),
        (500, None, False, "Resend returned 500: Internal Server Error"),
        (503, {"message": 7}, False, "Resend returned 503: Service Unavailable"),
    ],
)
def test_resend_errors(
    status: int, body: dict[str, Any] | None, permanent: bool, detail: str
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=body) if body else httpx.Response(status)

    with pytest.raises(EmailError) as exc_info:
        resend(handler).send(MESSAGE)
    assert exc_info.value.permanent is permanent
    assert str(exc_info.value) == detail


def test_resend_network_errors_are_temporary() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("timed out", request=request)

    with pytest.raises(EmailError) as exc_info:
        resend(handler).send(MESSAGE)
    assert exc_info.value.permanent is False
    assert str(exc_info.value) == "Resend unreachable: ConnectTimeout"


def test_resend_error_messages_never_include_the_api_key() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"message": "x" * 500})

    with pytest.raises(EmailError) as exc_info:
        resend(handler).send(MESSAGE)
    assert "re_test_key" not in str(exc_info.value)
    assert len(str(exc_info.value)) < 250  # provider text is truncated


# ---- SMTP --------------------------------------------------------------------------


class FakeSMTP:
    """Records what the backend does with the connection."""

    instances: ClassVar[list["FakeSMTP"]] = []
    fail_with: ClassVar[BaseException | None] = None

    def __init__(self, host: str, port: int, **kwargs: Any) -> None:
        self.host = host
        self.port = port
        self.kwargs = kwargs
        self.calls: list[str] = []
        self.sent: list[MimeMessage] = []
        FakeSMTP.instances.append(self)

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *_: object) -> None:
        self.calls.append("quit")

    def starttls(self, **_: Any) -> None:
        self.calls.append("starttls")

    def login(self, username: str, password: str) -> None:
        self.calls.append(f"login {username} {password}")

    def send_message(self, message: MimeMessage) -> None:
        if FakeSMTP.fail_with is not None:
            raise FakeSMTP.fail_with
        self.calls.append("send")
        self.sent.append(message)


@pytest.fixture(autouse=True)
def reset_fake_smtp() -> None:
    FakeSMTP.instances = []
    FakeSMTP.fail_with = None


def smtp_backend(security: Any = "starttls", username: str | None = "user") -> SmtpEmailBackend:
    return SmtpEmailBackend(
        "smtp.example.com",
        587,
        username=username,
        password="pw",
        security=security,
        timeout=7,
        smtp=FakeSMTP,  # type: ignore[arg-type]
        smtp_ssl=FakeSMTP,  # type: ignore[arg-type]
    )


def test_smtp_sends_a_multipart_email_over_starttls() -> None:
    backend = smtp_backend()
    message_id = backend.send(MESSAGE)
    backend.close()

    [conn] = FakeSMTP.instances
    assert (conn.host, conn.port, conn.kwargs) == ("smtp.example.com", 587, {"timeout": 7})
    assert conn.calls == ["starttls", "login user pw", "send", "quit"]
    [mime] = conn.sent
    assert mime["From"] == "ApplyTrack <noreply@applytrack.app>"
    assert mime["To"] == "ada@example.com"
    assert mime["Subject"] == "Hello"
    assert mime["Reply-To"] == "support@applytrack.app"
    assert mime["Message-ID"] == message_id
    assert message_id is not None
    assert message_id.endswith("@applytrack.app>")
    assert [part.get_content_type() for part in mime.iter_parts()] == [
        "text/plain",
        "text/html",
    ]


def test_smtp_implicit_tls_without_login() -> None:
    smtp_backend("tls", username=None).send(MESSAGE)
    [conn] = FakeSMTP.instances
    assert "context" in conn.kwargs  # certificate checking is on
    assert conn.calls == ["send", "quit"]


def test_smtp_without_encryption() -> None:
    message = EmailMessage(sender="a@b.co", to="c@d.co", subject="s", text="t", html="h")
    smtp_backend("none").send(message)
    [conn] = FakeSMTP.instances
    assert conn.calls == ["login user pw", "send", "quit"]
    assert conn.sent[0]["Reply-To"] is None


@pytest.mark.parametrize(
    ("error", "permanent", "detail"),
    [
        (
            smtplib.SMTPRecipientsRefused({"ada@example.com": (550, b"no such user")}),
            True,
            "SMTP refused the recipient: [550]",
        ),
        (
            smtplib.SMTPRecipientsRefused({"ada@example.com": (450, b"mailbox busy")}),
            False,
            "SMTP refused the recipient: [450]",
        ),
        (smtplib.SMTPAuthenticationError(535, b"bad credentials"), True, "SMTP error 535"),
        (smtplib.SMTPDataError(451, b"try later"), False, "SMTP error 451"),
        (smtplib.SMTPServerDisconnected("gone"), False, "SMTP unreachable: SMTPServerDisconnected"),
        (TimeoutError(), False, "SMTP unreachable: TimeoutError"),
    ],
)
def test_smtp_errors(error: BaseException, permanent: bool, detail: str) -> None:
    FakeSMTP.fail_with = error
    with pytest.raises(EmailError) as exc_info:
        smtp_backend().send(MESSAGE)
    assert exc_info.value.permanent is permanent
    assert str(exc_info.value) == detail


# ---- Choosing a backend from settings ----------------------------------------------


def test_build_email_backend(settings: Settings) -> None:
    assert isinstance(build_email_backend(settings), ConsoleEmailBackend)

    resend_settings = settings.model_copy(
        update={
            "email_backend": "resend",
            "resend_api_key": SecretStr("re_123"),
            "email_from": "a@applytrack.app",
        }
    )
    backend = build_email_backend(resend_settings)
    assert isinstance(backend, ResendEmailBackend)
    backend.close()

    smtp_settings = settings.model_copy(
        update={
            "email_backend": "smtp",
            "smtp_host": "smtp.example.com",
            "smtp_port": 465,
            "smtp_username": "u",
            "smtp_password": SecretStr("p"),
            "smtp_security": "tls",
            "email_from": "a@applytrack.app",
        }
    )
    smtp = build_email_backend(smtp_settings)
    assert isinstance(smtp, SmtpEmailBackend)
    assert (smtp.host, smtp.port, smtp.username, smtp.password, smtp.security) == (
        "smtp.example.com",
        465,
        "u",
        "p",
        "tls",
    )
    no_password = build_email_backend(smtp_settings.model_copy(update={"smtp_password": None}))
    assert isinstance(no_password, SmtpEmailBackend)
    assert no_password.password is None


# ---- python -m applytrack.mail -----------------------------------------------------


def test_send_test_email_command(
    monkeypatch: pytest.MonkeyPatch, settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    backend = MemoryEmailBackend()
    monkeypatch.setattr(send_test, "get_settings", lambda: settings)
    monkeypatch.setattr(send_test, "configure_logging", lambda **_: None)
    monkeypatch.setattr(send_test, "build_email_backend", lambda _: backend)

    assert send_test.main(["ada@example.com", "--locale", "ar"]) == 0

    [email] = backend.outbox
    assert email.to == "ada@example.com"
    assert email.subject == "إيميل تجريبي من Sekka"
    assert "Sent with the console backend (id: memory-1)" in capsys.readouterr().out


def test_send_test_email_command_reports_failures(
    monkeypatch: pytest.MonkeyPatch, settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    class Failing(MemoryEmailBackend):
        def send(self, message: EmailMessage) -> str | None:
            raise EmailError("Resend returned 403: Domain not verified", permanent=True)

    monkeypatch.setattr(send_test, "get_settings", lambda: settings)
    monkeypatch.setattr(send_test, "configure_logging", lambda **_: None)
    monkeypatch.setattr(send_test, "build_email_backend", lambda _: Failing())

    assert send_test.main(["ada@example.com"]) == 1
    assert "Failed (permanent): Resend returned 403" in capsys.readouterr().err


UNSUBSCRIBE_HEADERS = {
    "List-Unsubscribe": "<https://app.example.com/api/unsubscribe?token=abc>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
}


def test_resend_passes_extra_headers() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "x"})

    resend(handler).send(replace(MESSAGE, headers=UNSUBSCRIBE_HEADERS))
    assert json.loads(seen[0].content)["headers"] == UNSUBSCRIBE_HEADERS


def test_smtp_passes_extra_headers() -> None:
    backend = smtp_backend()
    backend.send(replace(MESSAGE, headers=UNSUBSCRIBE_HEADERS))
    [mime] = FakeSMTP.instances[0].sent
    assert mime["List-Unsubscribe"] == UNSUBSCRIBE_HEADERS["List-Unsubscribe"]
    assert mime["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
