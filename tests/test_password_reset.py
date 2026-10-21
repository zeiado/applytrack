"""Password reset (#44): the request, the link, and signing out everywhere."""

import logging
import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from applytrack.api.deps import get_now
from applytrack.core.config import Settings
from applytrack.core.rate_limit import InMemoryRateLimiter
from applytrack.jobs.worker import Worker
from applytrack.mail.backends import EmailMessage, MemoryEmailBackend
from applytrack.models import EmailTokenPurpose, User
from applytrack.services.email_tokens import EmailTokenService
from tests.conftest import AuthHelper, error_without_request_id

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"
ME = "/api/v1/users/me"


class Clock:
    """Starts at the real time: the reset is compared with access tokens' issue times,
    which use the real clock."""

    def __init__(self) -> None:
        self.now = datetime.now(UTC)

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture
def clock(app: FastAPI) -> Iterator[Clock]:
    clock = Clock()
    app.dependency_overrides[get_now] = lambda: clock.now
    yield clock
    app.dependency_overrides.clear()


@pytest.fixture
def ada(client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock) -> None:
    """A registered user, with the sign-up email already sent and cleared."""
    response = client.post(REGISTER, json={"email": "ada@example.com", "password": "old-password"})
    assert response.status_code == 201
    worker.run_pending()
    mailbox.outbox.clear()


def login(client: TestClient, password: str) -> Any:
    return client.post(LOGIN, data={"username": "ada@example.com", "password": password})


def forgot(client: TestClient, email: str = "ada@example.com") -> Any:
    return client.post(FORGOT, json={"email": email})


def sent(worker: Worker, mailbox: MemoryEmailBackend) -> list[EmailMessage]:
    worker.run_pending()
    return mailbox.outbox


def reset_token(email: EmailMessage) -> str:
    match = re.search(r"/reset-password#token=([A-Za-z0-9_-]+)", email.text)
    assert match, email.text
    return match.group(1)


def reset(client: TestClient, token: str, new_password: str = "new-password") -> Any:
    return client.post(RESET, json={"token": token, "new_password": new_password})


# ---- Asking for a reset ------------------------------------------------------------


@pytest.mark.usefixtures("ada")
def test_forgot_password_emails_a_reset_link(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, settings: Settings
) -> None:
    response = forgot(client, "  ADA@Example.com ")

    assert response.status_code == 202
    assert response.content == b""
    [email] = sent(worker, mailbox)
    assert email.to == "ada@example.com"
    assert email.subject == "Reset your ApplyTrack password"
    assert "expires in 30 minutes" in email.text
    link = f"{settings.public_app_url}/reset-password#token={reset_token(email)}"
    assert f'href="{link}"' in email.html


def test_the_reset_email_uses_the_account_language(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    client.post(REGISTER, json={"email": "ada@example.com", "password": "x" * 8, "locale": "ar"})
    forgot(client)

    _, email = sent(worker, mailbox)
    assert email.subject == "إعادة تعيين كلمة المرور في ApplyTrack"
    assert 'dir="rtl"' in email.html


@pytest.mark.usefixtures("ada")
def test_unknown_emails_get_the_same_answer_and_no_email(
    client: TestClient,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    caplog: pytest.LogCaptureFixture,
) -> None:
    known = forgot(client, "ada@example.com")
    with caplog.at_level(logging.INFO, logger="applytrack.auth"):
        unknown = forgot(client, "nobody@example.com")

    assert (unknown.status_code, unknown.content) == (known.status_code, known.content)
    assert [m.to for m in sent(worker, mailbox)] == ["ada@example.com"]
    [record] = [r for r in caplog.records if r.message == "Password reset for unknown email"]
    assert record.__dict__["to"] == "n***@example.com"  # masked in the logs


@pytest.mark.usefixtures("ada")
def test_each_account_gets_a_few_reset_emails_per_hour(
    client: TestClient,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    settings: Settings,
    clock: Clock,
) -> None:
    assert settings.email_token_limit_per_hour == 3
    for _ in range(5):
        assert forgot(client).status_code == 202  # never tells the caller it's limited
    assert len(sent(worker, mailbox)) == 3

    clock.advance(hours=1)
    forgot(client)
    assert len(sent(worker, mailbox)) == 4


def test_each_ip_is_limited_whatever_the_email(app: FastAPI, client: TestClient) -> None:
    app.state.forgot_password_limiter = InMemoryRateLimiter(limit=2, window_seconds=3600)
    assert forgot(client, "a@example.com").status_code == 202
    assert forgot(client, "b@example.com").status_code == 202

    blocked = forgot(client, "c@example.com")

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_reset_requests"
    assert 3590 <= int(blocked.headers["Retry-After"]) <= 3600


@pytest.mark.parametrize(
    "body", [{}, {"email": "not-an-email"}, {"email": "ada@example.com", "extra": 1}]
)
def test_forgot_password_validates_input(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(FORGOT, json=body).status_code == 422


# ---- Using the link ----------------------------------------------------------------


@pytest.mark.usefixtures("ada")
def test_reset_sets_the_new_password(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    forgot(client)
    [email] = sent(worker, mailbox)

    clock.advance(minutes=29)
    response = reset(client, reset_token(email))

    assert response.status_code == 204
    assert login(client, "old-password").status_code == 401
    assert login(client, "new-password").status_code == 200


@pytest.mark.usefixtures("ada")
def test_reset_signs_out_every_session(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    session = login(client, "old-password").json()
    headers = {"Authorization": f"Bearer {session['access_token']}"}
    assert client.get(ME, headers=headers).status_code == 200
    forgot(client)

    assert reset(client, reset_token(sent(worker, mailbox)[0])).status_code == 204

    old_access = client.get(ME, headers=headers)
    assert old_access.status_code == 401
    assert error_without_request_id(old_access) == {
        "error": {"code": "token_revoked", "message": "Token was revoked; log in again"}
    }
    assert client.post(REFRESH, json={"refresh_token": session["refresh_token"]}).status_code == 401
    # A login right after the reset works, even within the same second.
    fresh = login(client, "new-password").json()
    assert client.get(ME, headers={"Authorization": f"Bearer {fresh['access_token']}"}).is_success


@pytest.mark.usefixtures("ada")
def test_reset_emails_a_security_notice(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, settings: Settings
) -> None:
    forgot(client)
    reset(client, reset_token(sent(worker, mailbox)[0]))

    _, notice = sent(worker, mailbox)
    assert notice.to == "ada@example.com"
    assert notice.subject == "Your ApplyTrack password was changed"
    assert f"{settings.public_app_url}/forgot-password" in notice.text
    assert "#token=" not in notice.text


@pytest.mark.usefixtures("ada")
def test_reset_also_verifies_the_email(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    forgot(client)
    reset(client, reset_token(sent(worker, mailbox)[0]))

    token = login(client, "new-password").json()["access_token"]
    me = client.get(ME, headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email_verified"] is True


@pytest.mark.usefixtures("ada")
def test_a_reset_link_works_only_once(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    forgot(client)
    token = reset_token(sent(worker, mailbox)[0])
    assert reset(client, token).status_code == 204

    again = reset(client, token, "attacker-password")

    assert again.status_code == 400
    assert again.json()["error"]["code"] == "invalid_reset_token"
    assert login(client, "attacker-password").status_code == 401


@pytest.mark.usefixtures("ada")
def test_using_one_link_cancels_the_others(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    forgot(client)
    forgot(client)
    first, second = (reset_token(m) for m in sent(worker, mailbox))

    assert reset(client, second).status_code == 204
    assert reset(client, first, "other-password").status_code == 400


@pytest.mark.usefixtures("ada")
def test_an_expired_reset_link_is_refused(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    forgot(client)
    token = reset_token(sent(worker, mailbox)[0])

    clock.advance(minutes=30)
    response = reset(client, token)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "reset_token_expired"
    assert login(client, "old-password").status_code == 200


@pytest.mark.usefixtures("ada")
def test_a_verification_token_cannot_reset_the_password(
    app: FastAPI, client: TestClient, settings: Settings, clock: Clock
) -> None:
    with app.state.session_factory() as session:
        user = session.scalars(select(User)).one()
        token = EmailTokenService(session, settings).issue(
            user.id, EmailTokenPurpose.VERIFY_EMAIL, clock.now, timedelta(hours=1)
        )
        session.commit()

    response = reset(client, token)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_reset_token"


@pytest.mark.parametrize(
    "body",
    [
        {"token": "abc"},
        {"token": "abc", "new_password": "short"},
        {"token": "abc", "new_password": "x" * 129},
        {"token": "", "new_password": "long-enough"},
        {"token": "abc", "new_password": "long-enough", "extra": 1},
    ],
)
def test_reset_validates_input(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post(RESET, json=body).status_code == 422


def test_unknown_reset_token(client: TestClient) -> None:
    response = reset(client, "not-a-real-token")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_reset_token"


def test_users_who_never_reset_keep_working_tokens(auth: AuthHelper, client: TestClient) -> None:
    assert client.get(ME, headers=auth.headers()).status_code == 200
