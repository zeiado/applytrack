import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from applytrack.core.config import Settings
from applytrack.main import create_app
from applytrack.models import Base

# CI sets this to a real PostgreSQL database; locally tests default to in-memory SQLite.
TEST_DATABASE_URL = os.environ.get("APPLYTRACK_TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


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
