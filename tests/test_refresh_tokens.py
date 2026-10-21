import threading
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from applytrack.api.deps import get_now
from applytrack.core.config import Settings
from applytrack.core.errors import UnauthorizedError
from applytrack.core.security import hash_token
from applytrack.models import RefreshToken
from applytrack.services.tokens import TokenService
from tests.conftest import TEST_DATABASE_URL, AuthHelper

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/users/me"


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 20, 12, tzinfo=UTC)

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture
def clock(app: FastAPI) -> Iterator[Clock]:
    clock = Clock()
    app.dependency_overrides[get_now] = lambda: clock.now
    yield clock
    app.dependency_overrides.clear()


def login(client: TestClient, auth: AuthHelper) -> dict[str, Any]:
    auth.register()
    response = client.post(LOGIN, data={"username": "ada@example.com", "password": "correct-horse"})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def refresh(client: TestClient, token: str) -> Any:
    return client.post(REFRESH, json={"refresh_token": token})


def bearer(body: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {body['access_token']}"}


def test_login_returns_a_refresh_token(
    client: TestClient, auth: AuthHelper, settings: Settings, clock: Clock
) -> None:
    body = login(client, auth)

    assert body["refresh_token"]
    assert body["refresh_expires_in"] == settings.refresh_token_expire_days * 86400


def test_refresh_returns_a_new_working_pair(
    client: TestClient, auth: AuthHelper, clock: Clock
) -> None:
    first = login(client, auth)
    clock.advance(minutes=29)

    response = refresh(client, first["refresh_token"])

    assert response.status_code == 200
    second = response.json()
    assert second["refresh_token"] != first["refresh_token"]
    assert client.get(ME, headers=bearer(second)).status_code == 200


def test_refresh_keeps_a_session_alive_past_the_access_token_expiry(
    client: TestClient, auth: AuthHelper, clock: Clock
) -> None:
    body = login(client, auth)
    for _ in range(3):  # 3 x 25 minutes: longer than one 30-minute access token
        clock.advance(minutes=25)
        response = refresh(client, body["refresh_token"])
        assert response.status_code == 200
        body = response.json()


def test_reusing_a_rotated_token_signs_the_user_out_everywhere(
    client: TestClient, auth: AuthHelper, clock: Clock, caplog: pytest.LogCaptureFixture
) -> None:
    stolen = login(client, auth)
    other_device = client.post(
        LOGIN, data={"username": "ada@example.com", "password": "correct-horse"}
    ).json()
    rotated = refresh(client, stolen["refresh_token"]).json()

    response = refresh(client, stolen["refresh_token"])

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "refresh_token_reused"
    assert "Revoked refresh token reused" in caplog.text
    # Both the attacker's and the user's newer tokens are dead, on every device.
    for token in (rotated["refresh_token"], other_device["refresh_token"]):
        assert refresh(client, token).json()["error"]["code"] == "refresh_token_reused"


def test_expired_refresh_token_is_rejected(
    client: TestClient, auth: AuthHelper, settings: Settings, clock: Clock
) -> None:
    body = login(client, auth)
    clock.advance(days=settings.refresh_token_expire_days)

    response = refresh(client, body["refresh_token"])

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "refresh_token_expired"


@pytest.mark.parametrize("token", ["not-a-real-token", "x" * 256])
def test_unknown_refresh_token_is_rejected(client: TestClient, clock: Clock, token: str) -> None:
    response = refresh(client, token)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_refresh_token"
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "payload",
    [{}, {"refresh_token": ""}, {"refresh_token": "x" * 257}, {"refresh_token": "a", "extra": 1}],
    ids=["missing", "empty", "too-long", "extra-field"],
)
def test_refresh_validates_input(client: TestClient, payload: dict[str, Any]) -> None:
    assert client.post(REFRESH, json=payload).status_code == 422


def test_logout_revokes_the_refresh_token(
    client: TestClient, auth: AuthHelper, clock: Clock
) -> None:
    body = login(client, auth)

    response = client.post(LOGOUT, json={"refresh_token": body["refresh_token"]})

    assert response.status_code == 204
    assert response.content == b""
    assert refresh(client, body["refresh_token"]).status_code == 401


def test_logout_twice_or_with_unknown_token_still_succeeds(
    client: TestClient, auth: AuthHelper, clock: Clock
) -> None:
    body = login(client, auth)
    client.post(LOGOUT, json={"refresh_token": body["refresh_token"]})

    assert client.post(LOGOUT, json={"refresh_token": body["refresh_token"]}).status_code == 204
    assert client.post(LOGOUT, json={"refresh_token": "never-issued"}).status_code == 204


def test_only_a_hash_of_the_refresh_token_is_stored(
    client: TestClient, auth: AuthHelper, app: FastAPI, clock: Clock
) -> None:
    body = login(client, auth)

    with app.state.session_factory() as session:
        stored = session.scalars(select(RefreshToken)).all()

    assert [t.token_hash for t in stored] == [hash_token(body["refresh_token"])]
    assert body["refresh_token"] not in stored[0].token_hash
    assert stored[0].expires_at == clock.now + timedelta(days=30)
    assert stored[0].revoked_at is None


def test_rotation_keeps_the_token_family(
    client: TestClient, auth: AuthHelper, app: FastAPI, clock: Clock
) -> None:
    body = login(client, auth)
    refresh(client, body["refresh_token"])

    with app.state.session_factory() as session:
        stored = session.scalars(select(RefreshToken).order_by(RefreshToken.created_at)).all()

    assert len(stored) == 2
    assert stored[0].family_id == stored[1].family_id
    assert stored[0].revoked_at == clock.now
    assert stored[1].revoked_at is None


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="row locks need PostgreSQL; SQLite has no SELECT ... FOR UPDATE",
)
def test_concurrent_refreshes_with_one_token_cannot_both_succeed(
    app: FastAPI, client: TestClient, auth: AuthHelper, settings: Settings
) -> None:
    """Two refreshes with the same token at the same moment. The row lock makes the
    second one see the first one's rotation, so it counts as reuse."""
    token = login(client, auth)["refresh_token"]
    now = datetime.now(UTC)
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def worker() -> None:
        with app.state.session_factory() as session:
            barrier.wait()
            try:
                TokenService(session, settings).refresh(token, now)
                outcomes.append("ok")
            except UnauthorizedError as exc:
                outcomes.append(exc.code)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(outcomes) == ["ok", "refresh_token_reused"]
    with app.state.session_factory() as session:
        live = session.scalars(select(RefreshToken).where(RefreshToken.revoked_at.is_(None)))
        assert list(live) == []
