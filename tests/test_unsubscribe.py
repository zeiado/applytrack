"""Unsubscribing from reminder emails with the link in one (#71)."""

import uuid
from datetime import UTC, date, datetime
from typing import Any
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select

from applytrack.core.config import Settings
from applytrack.core.security import create_unsubscribe_token, read_unsubscribe_token
from applytrack.jobs.worker import Worker
from applytrack.mail.backends import EmailMessage, MemoryEmailBackend
from applytrack.models import User
from applytrack.services.reminder_emails import ReminderEmailScheduler
from tests.conftest import AuthHelper

UNSUBSCRIBE = "/api/v1/email/unsubscribe"
ME = "/api/v1/users/me"
TODAY = date(2026, 10, 21)
MORNING = datetime(2026, 10, 21, 8, tzinfo=ZoneInfo("Africa/Cairo")).astimezone(UTC)
NEXT_MORNING = datetime(2026, 10, 22, 8, tzinfo=ZoneInfo("Africa/Cairo")).astimezone(UTC)


# ---- The token ---------------------------------------------------------------------


def test_a_token_names_its_user(settings: Settings) -> None:
    user_id = uuid.uuid4()
    token = create_unsubscribe_token(user_id, settings)
    assert read_unsubscribe_token(token, settings) == user_id
    assert len(token) < 64


def test_a_token_signed_with_another_secret_is_rejected(settings: Settings) -> None:
    other = settings.model_copy(update={"jwt_secret_key": SecretStr("another-secret-" * 4)})
    token = create_unsubscribe_token(uuid.uuid4(), other)
    assert read_unsubscribe_token(token, settings) is None


def test_a_token_cant_be_moved_to_another_user(settings: Settings) -> None:
    _, signature = create_unsubscribe_token(uuid.uuid4(), settings).split(".")
    assert read_unsubscribe_token(f"{uuid.uuid4().hex}.{signature}", settings) is None


@pytest.mark.parametrize(
    "token",
    ["", "nonsense", "not-hex.abc", ".abc", "{hex}.", "{hex}", "{HEX}.{sig}", "{hex}.{sig}x"],
)
def test_malformed_tokens_are_rejected(settings: Settings, token: str) -> None:
    user_id = uuid.uuid4()
    sig = create_unsubscribe_token(user_id, settings).split(".")[1]
    token = token.format(hex=user_id.hex, HEX=user_id.hex.upper(), sig=sig)
    assert read_unsubscribe_token(token, settings) is None


# ---- The reminder email --------------------------------------------------------------


@pytest.fixture
def reminder(
    app: FastAPI,
    client: TestClient,
    auth: AuthHelper,
    settings: Settings,
    worker: Worker,
    mailbox: MemoryEmailBackend,
) -> Any:
    """Sign up, add an application due today, and send this morning's reminder."""

    def send(locale: str = "en", when: datetime = MORNING) -> EmailMessage | None:
        headers = auth.headers("ada@example.com")
        client.patch(ME, headers=headers, json={"locale": locale})
        with app.state.session_factory() as session:
            user = session.scalars(select(User)).one()
            user.email_verified_at = datetime.now(UTC)
            session.commit()
        body = {"company": "Valeo", "role_title": "Engineer", "follow_up_on": TODAY.isoformat()}
        assert client.post("/api/v1/applications", headers=headers, json=body).status_code == 201
        return run(when)

    def run(when: datetime) -> EmailMessage | None:
        ReminderEmailScheduler(app.state.session_factory, settings).run(when)
        worker.run_pending()
        reminders = [m for m in mailbox.outbox if "follow-up" in m.subject or "متابع" in m.subject]
        return reminders[-1] if reminders else None

    send.run = run  # type: ignore[attr-defined]
    return send


def one_click_token(email: EmailMessage) -> str:
    url = email.headers["List-Unsubscribe"].strip("<>")
    return parse_qs(urlsplit(url).query)["token"][0]


def test_the_reminder_has_one_click_unsubscribe_headers(reminder: Any, settings: Settings) -> None:
    email = reminder()

    assert email.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    url = email.headers["List-Unsubscribe"]
    assert url.startswith(f"<{settings.public_app_url}/api/unsubscribe?token=")
    token = one_click_token(email)
    page = f"{settings.public_app_url}/en/unsubscribe#token={token}"
    assert f"Unsubscribe: {page}" in email.text
    assert f'href="{page}"' in email.html
    assert f"{settings.public_app_url}/follow-ups" in email.text  # the page that exists


def test_the_unsubscribe_page_is_in_the_users_language(reminder: Any, settings: Settings) -> None:
    email = reminder("ar")
    assert f"{settings.public_app_url}/ar/unsubscribe#token=" in email.text


# ---- Unsubscribing -----------------------------------------------------------------


def test_unsubscribing_stops_reminders_without_logging_in(
    reminder: Any, client: TestClient, auth: AuthHelper
) -> None:
    token = one_click_token(reminder())

    assert client.post(UNSUBSCRIBE, json={"token": token}).status_code == 204
    me = client.get(ME, headers=auth.headers("ada@example.com")).json()
    assert me["reminder_emails"] is False


def test_no_reminder_the_next_morning(reminder: Any, client: TestClient) -> None:
    first = reminder()
    client.post(UNSUBSCRIBE, json={"token": one_click_token(first)})

    assert reminder.run(NEXT_MORNING) is first  # the last reminder is still yesterday's


def test_using_the_link_again_is_fine(reminder: Any, client: TestClient) -> None:
    token = one_click_token(reminder())
    assert client.post(UNSUBSCRIBE, json={"token": token}).status_code == 204
    assert client.post(UNSUBSCRIBE, json={"token": token}).status_code == 204


def test_a_bad_token_is_rejected(client: TestClient) -> None:
    response = client.post(UNSUBSCRIBE, json={"token": "nonsense"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_unsubscribe_token"


def test_a_deleted_account_has_nothing_to_unsubscribe(
    client: TestClient, settings: Settings
) -> None:
    token = create_unsubscribe_token(uuid.uuid4(), settings)
    assert client.post(UNSUBSCRIBE, json={"token": token}).status_code == 204
