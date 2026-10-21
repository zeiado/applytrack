from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

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


# --- The web app's server vouching for its visitor's IP ---------------------------

WEB_SECRET = "web-server-shared-secret-0123456789abcdef"


@pytest.fixture
def web_client() -> Iterator[TestClient]:
    """An app that trusts the web server's X-Client-IP, with a per-IP limit of 3."""
    settings = Settings(
        environment="test",
        database_url=TEST_DATABASE_URL,
        jwt_secret_key=SecretStr("test-secret-key-that-is-long-enough-123456"),
        client_ip_secret=SecretStr(WEB_SECRET),
        login_max_failures_per_ip=3,
    )
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with TestClient(app) as client:
        yield client
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()


def fail_login_via_web(
    client: TestClient, visitor: str, email: str, secret: str | None = WEB_SECRET
) -> int:
    headers = {"X-Client-IP": visitor}
    if secret is not None:
        headers["X-Proxy-Secret"] = secret
    response = client.post(
        "/api/v1/auth/login", data={"username": email, "password": "wrong"}, headers=headers
    )
    status: int = response.status_code
    return status


def test_web_server_visitors_are_limited_separately(web_client: TestClient) -> None:
    """All requests come from the web server; each visitor still has their own limit."""
    codes = [fail_login_via_web(web_client, "203.0.113.7", f"u{i}@example.com") for i in range(4)]
    assert codes == [401, 401, 401, 429]

    assert fail_login_via_web(web_client, "2001:db8::1", "u0@example.com") == 401


@pytest.mark.parametrize("secret", [None, "wrong-secret"], ids=["no-secret", "wrong-secret"])
def test_client_ip_without_the_secret_is_ignored(
    web_client: TestClient, secret: str | None, caplog: pytest.LogCaptureFixture
) -> None:
    # Each "visitor" is really the same client, so they share one limit.
    codes = [
        fail_login_via_web(web_client, f"192.0.2.{i}", f"u{i}@example.com", secret)
        for i in range(4)
    ]

    assert codes == [401, 401, 401, 429]
    assert ("Wrong X-Proxy-Secret" in caplog.text) == (secret is not None)


def test_invalid_client_ip_falls_back_to_the_connection(web_client: TestClient) -> None:
    codes = [fail_login_via_web(web_client, "not-an-ip", f"u{i}@example.com") for i in range(4)]
    assert codes == [401, 401, 401, 429]


def test_client_ip_is_ignored_when_no_secret_is_configured(proxied_client: TestClient) -> None:
    for i in range(3):
        fail_login(proxied_client, "203.0.113.7", f"u{i}@example.com")

    response = proxied_client.post(
        "/api/v1/auth/login",
        data={"username": "x@example.com", "password": "wrong"},
        headers={
            "X-Forwarded-For": "203.0.113.7",
            "X-Client-IP": "198.51.100.1",
            "X-Proxy-Secret": WEB_SECRET,
        },
    )
    assert response.status_code == 429


def test_short_client_ip_secret_fails_at_startup() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="test", client_ip_secret=SecretStr("too-short"))
