"""Email verification (#43): the email at sign-up, the link, resending, limits."""

import re
import threading
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select

from applytrack.api.deps import get_now
from applytrack.core.config import Settings
from applytrack.core.errors import AppError
from applytrack.jobs.worker import Worker
from applytrack.mail.backends import EmailMessage, MemoryEmailBackend
from applytrack.models import EmailToken, EmailTokenPurpose, Job, User
from applytrack.services.auth import AuthService
from applytrack.services.email_tokens import EmailTokenService
from applytrack.services.verification import EmailVerificationService
from tests.conftest import TEST_DATABASE_URL, AuthHelper, error_without_request_id

REGISTER = "/api/v1/auth/register"
VERIFY = "/api/v1/auth/verify-email"
RESEND = "/api/v1/auth/verify-email/resend"
ME = "/api/v1/users/me"


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 21, 9, tzinfo=UTC)

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture
def clock(app: FastAPI) -> Iterator[Clock]:
    clock = Clock()
    app.dependency_overrides[get_now] = lambda: clock.now
    yield clock
    app.dependency_overrides.clear()


def register(client: TestClient, email: str = "ada@example.com", locale: str = "en") -> None:
    response = client.post(
        REGISTER, json={"email": email, "password": "correct-horse", "locale": locale}
    )
    assert response.status_code == 201, response.text


def delivered(worker: Worker, mailbox: MemoryEmailBackend) -> list[EmailMessage]:
    """Run the queued jobs and return everything sent so far."""
    worker.run_pending()
    return mailbox.outbox


def token_in(email: EmailMessage) -> str:
    match = re.search(r"/verify-email#token=([A-Za-z0-9_-]+)", email.text)
    assert match, email.text
    return match.group(1)


def login_headers(auth: AuthHelper) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth.login()}"}


# ---- The email at sign-up ----------------------------------------------------------


def test_registering_sends_a_verification_email(
    client: TestClient,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    settings: Settings,
    clock: Clock,
) -> None:
    register(client)

    [email] = delivered(worker, mailbox)
    assert email.to == "ada@example.com"
    assert email.subject == "Confirm your email for ApplyTrack"
    assert "expires in 24 hours" in email.text
    link = f"{settings.public_app_url}/verify-email#token={token_in(email)}"
    assert link in email.text
    assert f'href="{link}"' in email.html


def test_the_email_is_in_the_language_chosen_at_sign_up(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    register(client, locale="ar")

    [email] = delivered(worker, mailbox)
    assert email.subject == "أكّد بريدك الإلكتروني في ApplyTrack"
    assert 'dir="rtl"' in email.html
    assert client.post(VERIFY, json={"token": token_in(email)}).status_code == 204


def test_only_a_hash_of_the_token_is_stored(
    app: FastAPI, client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    register(client)
    [email] = delivered(worker, mailbox)
    raw = token_in(email)

    with app.state.session_factory() as session:
        [stored] = session.scalars(select(EmailToken)).all()
        job_payloads = [job.payload for job in session.scalars(select(Job))]
    assert stored.token_hash != raw
    assert len(stored.token_hash) == 64
    assert stored.expires_at == clock.now + timedelta(hours=24)
    assert job_payloads == [{}]  # the sent email's link is gone from the queue too


def test_a_failed_sign_up_queues_no_email(
    app: FastAPI, client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    register(client)
    duplicate = client.post(REGISTER, json={"email": "ADA@example.com", "password": "other-pass"})
    assert duplicate.status_code == 409

    assert len(delivered(worker, mailbox)) == 1
    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(EmailToken)) == 1


def test_register_rejects_unknown_locales(client: TestClient) -> None:
    response = client.post(
        REGISTER, json={"email": "ada@example.com", "password": "correct-horse", "locale": "fr"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "body.locale"


# ---- Using the link ----------------------------------------------------------------


def test_the_link_verifies_the_email(
    app: FastAPI,
    client: TestClient,
    auth: AuthHelper,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    register(client)
    headers = login_headers(auth)
    assert client.get(ME, headers=headers).json()["email_verified"] is False
    [email] = delivered(worker, mailbox)

    clock.advance(hours=23, minutes=59)
    response = client.post(VERIFY, json={"token": token_in(email)})

    assert response.status_code == 204
    assert client.get(ME, headers=headers).json()["email_verified"] is True
    with app.state.session_factory() as session:
        user = session.scalars(select(User)).one()
        assert user.email_verified_at == clock.now


def test_a_link_works_only_once(
    client: TestClient, worker: Worker, mailbox: MemoryEmailBackend, clock: Clock
) -> None:
    register(client)
    token = token_in(delivered(worker, mailbox)[0])
    assert client.post(VERIFY, json={"token": token}).status_code == 204

    again = client.post(VERIFY, json={"token": token})

    assert again.status_code == 400
    assert error_without_request_id(again) == {
        "error": {
            "code": "invalid_verification_token",
            "message": "This link is invalid or was already used",
        }
    }


def test_an_expired_link_is_refused(
    client: TestClient,
    auth: AuthHelper,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    register(client)
    token = token_in(delivered(worker, mailbox)[0])

    clock.advance(hours=24)
    response = client.post(VERIFY, json={"token": token})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "verification_token_expired"
    assert client.get(ME, headers=login_headers(auth)).json()["email_verified"] is False


@pytest.mark.parametrize("token", ["not-a-real-token", "x" * 256])
def test_unknown_tokens_are_refused(client: TestClient, token: str) -> None:
    response = client.post(VERIFY, json={"token": token})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_verification_token"


@pytest.mark.parametrize(
    "body", [{}, {"token": ""}, {"token": "x" * 257}, {"token": "abc", "extra": 1}]
)
def test_verify_validates_input(client: TestClient, body: dict[str, object]) -> None:
    assert client.post(VERIFY, json=body).status_code == 422


def test_a_password_reset_token_does_not_verify_the_email(
    app: FastAPI, client: TestClient, settings: Settings, clock: Clock
) -> None:
    register(client)
    with app.state.session_factory() as session:
        user = session.scalars(select(User)).one()
        reset = EmailTokenService(session, settings).issue(
            user.id, EmailTokenPurpose.RESET_PASSWORD, clock.now, timedelta(minutes=30)
        )
        session.commit()

    response = client.post(VERIFY, json={"token": reset})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_verification_token"


# ---- Resending ---------------------------------------------------------------------


def test_resend_sends_a_new_link_and_using_it_cancels_the_old_one(
    client: TestClient,
    auth: AuthHelper,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    register(client)
    headers = login_headers(auth)

    response = client.post(RESEND, headers=headers)

    assert response.status_code == 202
    first, second = delivered(worker, mailbox)
    assert token_in(first) != token_in(second)
    assert client.post(VERIFY, json={"token": token_in(second)}).status_code == 204
    assert client.post(VERIFY, json={"token": token_in(first)}).status_code == 400


def test_resend_needs_a_login(client: TestClient) -> None:
    assert client.post(RESEND).status_code == 401


def test_resend_after_verifying_is_a_conflict(
    client: TestClient,
    auth: AuthHelper,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    clock: Clock,
) -> None:
    register(client)
    client.post(VERIFY, json={"token": token_in(delivered(worker, mailbox)[0])})

    response = client.post(RESEND, headers=login_headers(auth))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_already_verified"


def test_resend_is_limited_per_hour(
    client: TestClient,
    auth: AuthHelper,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    settings: Settings,
    clock: Clock,
) -> None:
    assert settings.email_token_limit_per_hour == 3
    register(client)  # the first email counts toward the limit
    headers = login_headers(auth)
    clock.advance(minutes=10)
    assert client.post(RESEND, headers=headers).status_code == 202
    clock.advance(minutes=10)
    assert client.post(RESEND, headers=headers).status_code == 202

    blocked = client.post(RESEND, headers=headers)

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_emails"
    # The sign-up email leaves the one-hour window 40 minutes from now.
    assert blocked.headers["Retry-After"] == str(40 * 60)
    assert len(delivered(worker, mailbox)) == 3

    clock.advance(minutes=40)
    assert client.post(RESEND, headers=headers).status_code == 202


def test_the_limit_is_per_account(
    client: TestClient, auth: AuthHelper, settings: Settings, clock: Clock
) -> None:
    settings.email_token_limit_per_hour = 1
    register(client, "ada@example.com")
    register(client, "grace@example.com")

    ada = client.post(RESEND, headers=login_headers(auth))
    grace = client.post(
        RESEND, headers={"Authorization": f"Bearer {auth.login('grace@example.com')}"}
    )

    assert ada.status_code == grace.status_code == 429


def test_retry_after_counts_from_the_oldest_email_in_the_window(
    app: FastAPI, settings: Settings, clock: Clock
) -> None:
    settings.email_token_limit_per_hour = 2
    with app.state.session_factory() as session:
        user = User(email="ada@example.com", password_hash="x")
        session.add(user)
        session.flush()
        tokens = EmailTokenService(session, settings)
        purpose = EmailTokenPurpose.VERIFY_EMAIL
        start = clock.now

        tokens.issue(user.id, purpose, start - timedelta(minutes=70), timedelta(hours=1))
        tokens.issue(user.id, purpose, start - timedelta(minutes=50), timedelta(hours=1))
        assert tokens.retry_after(user.id, purpose, start) is None  # one is outside

        tokens.issue(user.id, purpose, start - timedelta(minutes=5), timedelta(hours=1))
        assert tokens.retry_after(user.id, purpose, start) == 10 * 60

        other = EmailTokenPurpose.RESET_PASSWORD
        assert tokens.retry_after(user.id, other, start) is None  # counted separately


def test_register_without_a_hook(app: FastAPI) -> None:
    with app.state.session_factory() as session:
        user = AuthService(session).register("ada@example.com", "correct-horse")
    assert user.locale == "en"
    assert user.email_verified is False


@pytest.mark.parametrize("url", ["localhost:3000", "ftp://app.example.com"])
def test_public_app_url_must_be_http(url: str) -> None:
    with pytest.raises(ValidationError, match="APPLYTRACK_PUBLIC_APP_URL"):
        Settings(_env_file=None, public_app_url=url)


def test_public_app_url_trailing_slash_is_dropped() -> None:
    settings = Settings(_env_file=None, public_app_url="https://app.example.com/")
    assert settings.public_app_url == "https://app.example.com"


# ---- Concurrency and cleanup -------------------------------------------------------


def test_deleting_the_account_deletes_its_tokens(
    app: FastAPI, client: TestClient, auth: AuthHelper, clock: Clock
) -> None:
    register(client)
    response = client.request(
        "DELETE", ME, headers=login_headers(auth), json={"password": "correct-horse"}
    )
    assert response.status_code == 204
    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(EmailToken)) == 0


def test_housekeeping_deletes_links_a_day_after_they_expire(
    app: FastAPI, worker: Worker, settings: Settings
) -> None:
    now = datetime.now(UTC)
    worker.clock = lambda: now
    with app.state.session_factory() as session:
        user = User(email="ada@example.com", password_hash="x")
        session.add(user)
        session.flush()
        tokens = EmailTokenService(session, settings)
        purpose = EmailTokenPurpose.VERIFY_EMAIL
        tokens.issue(user.id, purpose, now - timedelta(days=3), timedelta(days=1))  # deleted
        tokens.issue(user.id, purpose, now - timedelta(hours=30), timedelta(hours=24))  # kept
        session.commit()

    worker.housekeep()

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(EmailToken)) == 1


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="row locks need PostgreSQL; SQLite has no SELECT ... FOR UPDATE",
)
def test_one_link_used_twice_at_once_works_only_once(
    app: FastAPI,
    client: TestClient,
    worker: Worker,
    mailbox: MemoryEmailBackend,
    settings: Settings,
) -> None:
    register(client)
    token = token_in(delivered(worker, mailbox)[0])
    now = datetime.now(UTC)
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def use() -> None:
        with app.state.session_factory() as session:
            barrier.wait()
            try:
                EmailVerificationService(session, settings).verify(token, now)
                outcomes.append("ok")
            except AppError as exc:
                session.rollback()
                outcomes.append(exc.code)

    threads = [threading.Thread(target=use) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(outcomes) == ["invalid_verification_token", "ok"]
