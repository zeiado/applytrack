"""Product analytics (#70): what the API reports to PostHog, and that it holds no
personal data."""

import uuid
from datetime import date
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from applytrack.core.analytics import (
    DailyActivity,
    MemoryAnalytics,
    NoAnalytics,
    PostHogAnalytics,
    build_analytics,
)
from applytrack.core.config import Settings
from tests.conftest import AuthHelper

APPS = "/api/v1/applications"


@pytest.fixture
def analytics(app: FastAPI) -> MemoryAnalytics:
    memory = MemoryAnalytics()
    app.state.analytics = memory
    return memory


def test_off_unless_a_key_is_set(settings: Settings) -> None:
    assert isinstance(build_analytics(settings), NoAnalytics)
    on = settings.model_copy(update={"posthog_api_key": "phc_test"})
    tracker = build_analytics(on)
    assert isinstance(tracker, PostHogAnalytics)
    tracker.close()


def test_sign_up(client: TestClient, analytics: MemoryAnalytics) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "ada@example.com", "password": "correct-horse", "locale": "ar"},
    )
    user_id = uuid.UUID(response.json()["id"])

    assert analytics.events == [(user_id, "signed_up", {"method": "password", "locale": "ar"})]


def test_a_failed_sign_up_sends_nothing(
    client: TestClient, auth: AuthHelper, analytics: MemoryAnalytics
) -> None:
    auth.headers("ada@example.com")
    analytics.events.clear()
    body = {"email": "ada@example.com", "password": "another-pass"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 409
    assert "signed_up" not in analytics.names()


def test_first_and_later_applications(
    client: TestClient, auth: AuthHelper, analytics: MemoryAnalytics
) -> None:
    headers = auth.headers("ada@example.com")
    body = {"company": "Valeo", "role_title": "Engineer", "source": "referral"}
    client.post(APPS, headers=headers, json=body)
    client.post(APPS, headers=headers, json={**body, "status": "wishlist"})

    created = [props for _, name, props in analytics.events if name == "application_created"]
    assert created == [
        {"status": "applied", "source": "referral", "first": True},
        {"status": "wishlist", "source": "referral", "first": False},
    ]


def test_events_carry_no_personal_data(
    client: TestClient, auth: AuthHelper, analytics: MemoryAnalytics
) -> None:
    headers = auth.headers("ada@example.com")
    client.post(
        APPS,
        headers=headers,
        json={"company": "Secret Co", "role_title": "Spy", "notes": "call Mona 0100"},
    )
    sent = repr(analytics.events)
    for personal in ("ada@example.com", "Secret Co", "Spy", "Mona"):
        assert personal not in sent


def test_active_once_a_day_per_user(
    client: TestClient, auth: AuthHelper, analytics: MemoryAnalytics
) -> None:
    ada = auth.headers("ada@example.com")
    bob = auth.headers("bob@example.com")
    for headers in (ada, ada, bob, ada):
        assert client.get("/api/v1/users/me", headers=headers).status_code == 200

    assert analytics.names().count("active") == 2


def test_daily_activity_starts_over_each_day() -> None:
    analytics = MemoryAnalytics()
    activity = DailyActivity(max_users=2)
    ada, bob, cy = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    activity.record(analytics, ada, date(2026, 10, 21))
    activity.record(analytics, ada, date(2026, 10, 21))
    activity.record(analytics, ada, date(2026, 10, 22))
    assert analytics.names() == ["active", "active"]

    # Memory is capped: past the limit it forgets, at worst counting someone twice.
    activity.record(analytics, bob, date(2026, 10, 22))
    activity.record(analytics, cy, date(2026, 10, 22))
    assert len(analytics.events) == 4


def test_posthog_gets_the_user_id_and_never_breaks_a_request(
    caplog: pytest.LogCaptureFixture,
) -> None:
    client = MagicMock()
    tracker = PostHogAnalytics("phc_test", "https://eu.i.posthog.com", client=client)
    user_id = uuid.uuid4()

    tracker.capture(user_id, "active")
    client.capture.assert_called_once_with("active", distinct_id=str(user_id), properties={})

    client.capture.side_effect = RuntimeError("queue full")
    tracker.capture(user_id, "active")  # doesn't raise
    assert "Analytics event dropped" in caplog.text

    tracker.close()
    client.shutdown.assert_called_once()


def test_the_app_flushes_analytics_on_shutdown(settings: Settings) -> None:
    from applytrack.main import create_app

    app = create_app(settings)
    closed: list[Any] = []
    app.state.analytics = MagicMock(close=lambda: closed.append(True))
    with TestClient(app):
        pass
    assert closed == [True]
