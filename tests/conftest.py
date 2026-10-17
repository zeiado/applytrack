import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pydantic import SecretStr

from applytrack.core import security
from applytrack.core.config import Settings
from applytrack.main import create_app
from applytrack.models import Base

# CI sets this to a real PostgreSQL database; locally tests default to in-memory SQLite.
TEST_DATABASE_URL = os.environ.get("APPLYTRACK_TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture(autouse=True)
def fast_password_hashing(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    """Argon2 is slow on purpose (~60 ms). Tests use the cheapest settings, which are
    still real Argon2 hashes; production keeps the secure defaults.
    Mark a test with @pytest.mark.real_hashing to opt out."""
    if request.node.get_closest_marker("real_hashing"):
        return
    fast = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=1024, parallelism=1),))
    monkeypatch.setattr(security, "_password_hash", fast)
    monkeypatch.setattr(security, "_DUMMY_HASH", fast.hash("not-a-real-password"))


@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="test",
        database_url=TEST_DATABASE_URL,
        jwt_secret_key=SecretStr("test-secret-key-that-is-long-enough-123456"),
    )


@pytest.fixture
def app(settings: Settings) -> Iterator[FastAPI]:
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    yield app
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


class AuthHelper:
    """Registers users and returns auth headers, so tests read like user stories."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def register(
        self, email: str = "ada@example.com", password: str = "correct-horse"
    ) -> dict[str, Any]:
        response = self.client.post(
            "/api/v1/auth/register", json={"email": email, "password": password}
        )
        assert response.status_code == 201, response.text
        body: dict[str, Any] = response.json()
        return body

    def login(self, email: str = "ada@example.com", password: str = "correct-horse") -> str:
        response = self.client.post(
            "/api/v1/auth/login", data={"username": email, "password": password}
        )
        assert response.status_code == 200, response.text
        token: str = response.json()["access_token"]
        return token

    def headers(
        self, email: str = "ada@example.com", password: str = "correct-horse"
    ) -> dict[str, str]:
        """Register (if needed) and log in; return an Authorization header."""
        self.client.post("/api/v1/auth/register", json={"email": email, "password": password})
        return {"Authorization": f"Bearer {self.login(email, password)}"}


@pytest.fixture
def auth(client: TestClient) -> AuthHelper:
    return AuthHelper(client)
