from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from applytrack.core.config import Settings
from applytrack.core.rate_limit import DatabaseRateLimiter, InMemoryRateLimiter, LoginRateLimiter
from applytrack.main import create_app
from applytrack.models import Base
from applytrack.services import auth as auth_service
from tests.conftest import AuthHelper, error_without_request_id
from tests.test_rate_limit import FakeClock

LOGIN = "/api/v1/auth/login"


@pytest.fixture
def clock(app: FastAPI) -> FakeClock:
    """Replace the app's limiter with one on a fake clock (same limits as the settings)."""
    fake = FakeClock()
    settings = app.state.settings
    app.state.login_limiter = LoginRateLimiter(
        per_account=InMemoryRateLimiter(
            limit=settings.login_max_failures_per_account,
            window_seconds=settings.login_window_seconds,
            clock=fake,
        ),
        per_ip=InMemoryRateLimiter(
            limit=settings.login_max_failures_per_ip,
            window_seconds=settings.login_window_seconds,
            clock=fake,
        ),
    )
    return fake


def login(client: TestClient, email: str = "ada@example.com", password: str = "wrong-horse") -> int:
    status_code: int = client.post(
        LOGIN, data={"username": email, "password": password}
    ).status_code
    return status_code


@pytest.fixture(autouse=True)
def registered(auth: AuthHelper) -> None:
    auth.register("ada@example.com", "correct-horse")


@pytest.mark.usefixtures("clock")
def test_sixth_failure_in_a_minute_is_blocked(client: TestClient) -> None:
    assert [login(client) for _ in range(5)] == [401] * 5

    response = client.post(LOGIN, data={"username": "ada@example.com", "password": "wrong-horse"})

    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"
    assert error_without_request_id(response) == {
        "error": {
            "code": "too_many_login_attempts",
            "message": "Too many failed login attempts. Try again in 60 seconds.",
        }
    }


@pytest.mark.usefixtures("clock")
def test_blocked_even_with_the_right_password(client: TestClient) -> None:
    for _ in range(5):
        login(client)

    assert login(client, password="correct-horse") == 429


@pytest.mark.usefixtures("clock")
def test_email_case_and_spaces_dont_bypass_the_limit(client: TestClient) -> None:
    for email in [
        "ada@example.com",
        "ADA@example.com",
        " Ada@Example.com",
        "ada@EXAMPLE.com",
        "ADA@EXAMPLE.COM",
    ]:
        login(client, email=email)

    assert login(client) == 429


def test_allowed_again_after_the_window(client: TestClient, clock: FakeClock) -> None:
    for _ in range(5):
        login(client)
    assert login(client) == 429

    clock.advance(60)

    assert login(client, password="correct-horse") == 200


@pytest.mark.usefixtures("clock")
def test_success_resets_the_count(client: TestClient) -> None:
    for _ in range(4):
        login(client)
    assert login(client, password="correct-horse") == 200

    assert [login(client) for _ in range(5)] == [401] * 5  # fresh budget of 5


@pytest.mark.usefixtures("clock")
def test_other_accounts_from_the_same_ip_are_not_blocked_by_one_account(
    client: TestClient, auth: AuthHelper
) -> None:
    auth.register("grace@example.com", "correct-horse")
    for _ in range(5):
        login(client)

    assert login(client, email="grace@example.com", password="correct-horse") == 200


@pytest.mark.usefixtures("clock")
def test_per_ip_limit_stops_trying_many_accounts(client: TestClient) -> None:
    """Credential stuffing: one IP, many emails, a few tries each."""
    for i in range(20):
        assert login(client, email=f"user{i}@example.com") == 401

    assert login(client, email="someone-new@example.com") == 429


@pytest.mark.usefixtures("clock")
def test_blocked_attempts_skip_the_password_check(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[object] = []

    def spy(*args: object) -> bool:
        calls.append(args)
        return False

    monkeypatch.setattr(auth_service, "verify_password", spy)

    for _ in range(5):
        assert login(client) == 401
    assert len(calls) == 5  # the spy sees every allowed attempt...

    assert login(client) == 429
    assert len(calls) == 5  # ...but none of the blocked ones: no Argon2 work


def test_limits_come_from_settings(app: FastAPI, client: TestClient) -> None:
    per_account = app.state.login_limiter.per_account

    assert per_account.limit == app.state.settings.login_max_failures_per_account == 5
    assert per_account.window == app.state.settings.login_window_seconds == 60


def test_memory_by_default_and_database_in_production(settings: Settings) -> None:
    assert not settings.rate_limits_in_database  # environment="test"
    production = settings.model_copy(update={"environment": "production"})
    assert production.rate_limits_in_database
    assert not production.model_copy(update={"rate_limit_store": "memory"}).rate_limits_in_database
    assert settings.model_copy(update={"rate_limit_store": "database"}).rate_limits_in_database


def test_database_store_keeps_counting_after_a_restart(settings: Settings, tmp_path: Path) -> None:
    """Two app instances on one database: a second process, or the app after a deploy."""
    database = settings.model_copy(
        update={"rate_limit_store": "database", "database_url": f"sqlite:///{tmp_path / 'a.db'}"}
    )
    first = create_app(database)
    Base.metadata.create_all(first.state.engine)
    assert isinstance(first.state.login_limiter.per_account, DatabaseRateLimiter)
    assert isinstance(first.state.forgot_password_limiter, DatabaseRateLimiter)
    with TestClient(first) as client:
        AuthHelper(client).register("ada@example.com", "correct-horse")
        assert [login(client) for _ in range(5)] == [401] * 5
    first.state.engine.dispose()

    second = create_app(database)
    with TestClient(second) as client:
        assert login(client) == 429
        assert login(client, password="correct-horse") == 429
    second.state.engine.dispose()
