import threading
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from applytrack.core.errors import ConflictError
from applytrack.models import Application, ApplicationStatus, StatusChange, User
from applytrack.services.applications import ApplicationService
from tests.conftest import TEST_DATABASE_URL, AuthHelper

URL = "/api/v1/applications"


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def new_application(client: TestClient, headers: dict[str, str], **fields: Any) -> str:
    payload = {"company": "Acme", "role_title": "Engineer", **fields}
    response = client.post(URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    application_id: str = response.json()["id"]
    return application_id


def move(
    client: TestClient, headers: dict[str, str], app_id: str, status: str, **extra: Any
) -> Any:
    return client.post(f"{URL}/{app_id}/status", json={"status": status, **extra}, headers=headers)


def history(client: TestClient, headers: dict[str, str], app_id: str) -> list[dict[str, Any]]:
    response = client.get(f"{URL}/{app_id}/history", headers=headers)
    assert response.status_code == 200, response.text
    body: list[dict[str, Any]] = response.json()
    return body


def test_new_application_starts_its_history(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers, status="wishlist")

    [entry] = history(client, headers, app_id)

    assert entry["from_status"] is None
    assert entry["to_status"] == "wishlist"
    assert entry["changed_at"]


def test_full_pipeline_to_accepted(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers, status="wishlist")

    for status in ["applied", "screening", "interviewing", "offer", "accepted"]:
        response = move(client, headers, app_id, status)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == status

    steps = [(h["from_status"], h["to_status"]) for h in history(client, headers, app_id)]
    assert steps == [
        (None, "wishlist"),
        ("wishlist", "applied"),
        ("applied", "screening"),
        ("screening", "interviewing"),
        ("interviewing", "offer"),
        ("offer", "accepted"),
    ]


def test_response_lists_next_statuses(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers)

    body = move(client, headers, app_id, "interviewing").json()

    assert body["next_statuses"] == ["offer", "rejected", "withdrawn"]


def test_status_note_is_saved(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers)

    move(client, headers, app_id, "rejected", note="Position filled internally")

    assert history(client, headers, app_id)[-1]["note"] == "Position filled internally"


def test_invalid_transition_is_conflict_and_changes_nothing(
    client: TestClient, headers: dict[str, str]
) -> None:
    app_id = new_application(client, headers)
    move(client, headers, app_id, "rejected")

    response = move(client, headers, app_id, "applied")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "invalid_transition"
    assert error["message"] == "Cannot move from rejected: it is a final status"
    assert error["details"] == [{"from": "rejected", "to": "applied", "allowed": []}]
    assert client.get(f"{URL}/{app_id}", headers=headers).json()["status"] == "rejected"
    assert len(history(client, headers, app_id)) == 2


def test_conflict_lists_allowed_statuses(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers, status="wishlist")

    response = move(client, headers, app_id, "offer")

    assert response.json()["error"]["details"][0]["allowed"] == ["applied", "withdrawn"]


def test_moving_to_the_same_status_is_conflict(client: TestClient, headers: dict[str, str]) -> None:
    app_id = new_application(client, headers)

    response = move(client, headers, app_id, "applied")

    assert response.status_code == 409
    assert response.json()["error"]["message"] == "Application is already applied"


@pytest.mark.parametrize(
    "body",
    [
        {"status": "hired"},
        {},
        {"status": "screening", "extra": 1},
        {"status": "screening", "note": "x" * 10_001},
    ],
    ids=["unknown-status", "missing-status", "extra-field", "long-note"],
)
def test_invalid_status_request_is_validation_error(
    client: TestClient, headers: dict[str, str], body: dict[str, Any]
) -> None:
    app_id = new_application(client, headers)

    response = client.post(f"{URL}/{app_id}/status", json=body, headers=headers)

    assert response.status_code == 422


@pytest.mark.parametrize("path", ["status", "history"])
def test_other_users_get_not_found(
    client: TestClient, auth: AuthHelper, headers: dict[str, str], path: str
) -> None:
    app_id = new_application(client, headers)
    other = auth.headers("grace@example.com")

    if path == "status":
        response = move(client, other, app_id, "screening")
    else:
        response = client.get(f"{URL}/{app_id}/history", headers=other)

    assert response.status_code == 404
    assert client.get(f"{URL}/{app_id}", headers=headers).json()["status"] == "applied"


def test_unknown_application_is_not_found(client: TestClient, headers: dict[str, str]) -> None:
    assert move(client, headers, str(uuid.uuid4()), "screening").status_code == 404
    assert client.get(f"{URL}/{uuid.uuid4()}/history", headers=headers).status_code == 404


def test_deleting_an_application_deletes_its_history(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    app_id = new_application(client, headers)
    move(client, headers, app_id, "screening")

    client.delete(f"{URL}/{app_id}", headers=headers)

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(StatusChange)) == 0


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="row locks need PostgreSQL; SQLite has no SELECT ... FOR UPDATE",
)
def test_concurrent_status_changes_are_serialized(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    """Two requests move the same application at the same moment. The row lock makes
    the second one see the first one's result, so exactly one succeeds."""
    app_id = uuid.UUID(new_application(client, headers))
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def worker() -> None:
        with app.state.session_factory() as session:
            user = session.scalar(select(User).where(User.email == "ada@example.com"))
            assert user is not None
            barrier.wait()
            try:
                ApplicationService(session, user).change_status(app_id, ApplicationStatus.SCREENING)
                outcomes.append("ok")
            except ConflictError:
                outcomes.append("conflict")

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(outcomes) == ["conflict", "ok"]
    with app.state.session_factory() as session:
        count = session.scalar(
            select(func.count())
            .select_from(StatusChange)
            .where(StatusChange.application_id == app_id)
        )
        assert count == 2  # initial + one change
        assert session.get(Application, app_id).status == ApplicationStatus.SCREENING
