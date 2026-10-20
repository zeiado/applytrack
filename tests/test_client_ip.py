from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from applytrack.core.client_ip import resolve_client_ip
from applytrack.core.config import Settings
from applytrack.main import create_app
from applytrack.models import Base
from tests.conftest import TEST_DATABASE_URL

PEER = "10.0.0.5"


@pytest.mark.parametrize(
    ("headers", "hops", "expected"),
    [
        ([], 0, PEER),
        (["203.0.113.7"], 0, PEER),  # no proxies trusted: the header is ignored
        (["203.0.113.7"], 1, "203.0.113.7"),
        (["1.1.1.1, 203.0.113.7"], 1, "203.0.113.7"),  # forged entry on the left ignored
        (["1.1.1.1, 203.0.113.7, 10.1.0.1"], 2, "203.0.113.7"),
        (["1.1.1.1", "203.0.113.7, 10.1.0.1"], 2, "203.0.113.7"),  # repeated headers join
        (["203.0.113.7"], 2, PEER),  # shorter than the trusted chain
        ([], 1, PEER),
        (["not-an-ip"], 1, PEER),
        ([" 2001:db8::1 "], 1, "2001:db8::1"),
        (["203.0.113.7,,"], 1, "203.0.113.7"),
    ],
)
def test_resolve_client_ip(headers: list[str], hops: int, expected: str) -> None:
    assert resolve_client_ip(PEER, headers, hops) == expected


@pytest.fixture
def proxied_client() -> Iterator[TestClient]:
    """An app behind one trusted proxy, with a per-IP limit of 3 failed logins."""
    settings = Settings(
        environment="test",
        database_url=TEST_DATABASE_URL,
        jwt_secret_key=SecretStr("test-secret-key-that-is-long-enough-123456"),
        trusted_proxy_hops=1,
        login_max_failures_per_ip=3,
    )
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with TestClient(app) as client:
        yield client
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()


def fail_login(client: TestClient, forwarded_for: str, email: str) -> int:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "wrong-horse"},
        headers={"X-Forwarded-For": forwarded_for},
    )
    status: int = response.status_code
    return status


def test_per_ip_limit_applies_per_real_client(proxied_client: TestClient) -> None:
    codes = [fail_login(proxied_client, "203.0.113.7", f"u{i}@example.com") for i in range(4)]
    assert codes == [401, 401, 401, 429]

    # Another client behind the same proxy is not blocked.
    assert fail_login(proxied_client, "198.51.100.9", "u0@example.com") == 401


def test_forged_entries_dont_dodge_the_limit(proxied_client: TestClient) -> None:
    codes = [
        fail_login(proxied_client, f"192.0.2.{i}, 203.0.113.7", f"u{i}@example.com")
        for i in range(4)
    ]
    assert codes == [401, 401, 401, 429]


def test_access_log_shows_the_real_client(
    proxied_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level("DEBUG", logger="applytrack.access"):
        proxied_client.get("/health", headers={"X-Forwarded-For": "1.1.1.1, 203.0.113.7"})

    lines = [r for r in caplog.records if r.name == "applytrack.access" and r.levelname == "INFO"]
    assert lines[-1].__dict__["http"]["client"] == "203.0.113.7"
    assert "X-Forwarded-For has 2 entries" in caplog.text
