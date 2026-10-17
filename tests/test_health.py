from fastapi.testclient import TestClient

from applytrack import __version__
from applytrack.core.config import Settings
from applytrack.main import create_app


def test_health_returns_ok_and_version(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


def test_ready_when_database_is_reachable(client: TestClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_ready_returns_503_when_database_is_down() -> None:
    # Port 1 on localhost refuses connections immediately.
    settings = Settings(
        environment="test",
        database_url="postgresql+psycopg://user:pass@127.0.0.1:1/missing?connect_timeout=1",
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unreachable"}
