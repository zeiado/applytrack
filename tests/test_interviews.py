import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from applytrack.models import Interview
from tests.conftest import AuthHelper


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


@pytest.fixture
def app_id(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/api/v1/applications", json={"company": "Acme", "role_title": "Engineer"}, headers=headers
    )
    application_id: str = response.json()["id"]
    return application_id


def url(app_id: str, interview_id: str | None = None) -> str:
    base = f"/api/v1/applications/{app_id}/interviews"
    return f"{base}/{interview_id}" if interview_id else base


def add(client: TestClient, headers: dict[str, str], app_id: str, **fields: Any) -> dict[str, Any]:
    payload = {"scheduled_at": "2026-10-20T14:00:00+03:00", **fields}
    response = client.post(url(app_id), json=payload, headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_create_with_all_fields(client: TestClient, headers: dict[str, str], app_id: str) -> None:
    payload = {
        "scheduled_at": "2026-10-20T14:00:00+03:00",
        "kind": "technical",
        "duration_minutes": 60,
        "interviewer": "  Grace Hopper ",
        "notes": "System design round",
    }

    response = client.post(url(app_id), json=payload, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert response.headers["location"] == url(app_id, body["id"])
    assert body["application_id"] == app_id
    assert body["scheduled_at"] == "2026-10-20T11:00:00Z"  # stored and returned in UTC
    assert body["kind"] == "technical"
    assert body["duration_minutes"] == 60
    assert body["interviewer"] == "Grace Hopper"
    assert body["notes"] == "System design round"


def test_create_defaults(client: TestClient, headers: dict[str, str], app_id: str) -> None:
    body = add(client, headers, app_id)

    assert body["kind"] == "other"
    assert body["duration_minutes"] is None


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"scheduled_at": "2026-10-20T14:00:00"}, "body.scheduled_at"),  # no timezone
        ({}, "body.scheduled_at"),
        ({"scheduled_at": "2026-10-20T14:00:00Z", "kind": "karaoke"}, "body.kind"),
        ({"scheduled_at": "2026-10-20T14:00:00Z", "duration_minutes": 0}, "body.duration_minutes"),
        (
            {"scheduled_at": "2026-10-20T14:00:00Z", "duration_minutes": 1441},
            "body.duration_minutes",
        ),
        ({"scheduled_at": "2026-10-20T14:00:00Z", "interviewer": ""}, "body.interviewer"),
        (
            {"scheduled_at": "2026-10-20T14:00:00Z", "application_id": str(uuid.uuid4())},
            "body.application_id",
        ),
    ],
    ids=[
        "naive-time",
        "missing-time",
        "bad-kind",
        "zero-duration",
        "long-duration",
        "empty-interviewer",
        "extra-field",
    ],
)
def test_create_rejects_invalid_input(
    client: TestClient, headers: dict[str, str], app_id: str, payload: dict[str, Any], field: str
) -> None:
    response = client.post(url(app_id), json=payload, headers=headers)

    assert response.status_code == 422
    assert field in [d["field"] for d in response.json()["error"]["details"]]


def test_list_is_ordered_by_time(client: TestClient, headers: dict[str, str], app_id: str) -> None:
    add(client, headers, app_id, scheduled_at="2026-10-22T09:00:00Z", notes="third")
    add(client, headers, app_id, scheduled_at="2026-10-20T09:00:00Z", notes="first")
    add(client, headers, app_id, scheduled_at="2026-10-21T09:00:00Z", notes="second")

    response = client.get(url(app_id), headers=headers)

    assert response.status_code == 200
    assert [i["notes"] for i in response.json()] == ["first", "second", "third"]


def test_list_only_includes_this_applications_interviews(
    client: TestClient, headers: dict[str, str], app_id: str
) -> None:
    other_app = client.post(
        "/api/v1/applications", json={"company": "Beta", "role_title": "Dev"}, headers=headers
    ).json()["id"]
    add(client, headers, app_id, notes="acme")
    add(client, headers, other_app, notes="beta")

    assert [i["notes"] for i in client.get(url(app_id), headers=headers).json()] == ["acme"]


def test_get_update_delete(client: TestClient, headers: dict[str, str], app_id: str) -> None:
    created = add(client, headers, app_id, interviewer="Grace", notes="Prep: graphs")

    assert client.get(url(app_id, created["id"]), headers=headers).json() == created

    patched = client.patch(
        url(app_id, created["id"]),
        json={"kind": "onsite", "notes": None, "scheduled_at": "2026-10-25T10:00:00Z"},
        headers=headers,
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["kind"] == "onsite"
    assert body["notes"] is None
    assert body["scheduled_at"] == "2026-10-25T10:00:00Z"
    assert body["interviewer"] == "Grace"  # untouched

    assert client.delete(url(app_id, created["id"]), headers=headers).status_code == 204
    assert client.get(url(app_id, created["id"]), headers=headers).status_code == 404


@pytest.mark.parametrize(
    "payload", [{"scheduled_at": None}, {"kind": None}, {"duration_minutes": -5}]
)
def test_patch_rejects_invalid_changes(
    client: TestClient, headers: dict[str, str], app_id: str, payload: dict[str, Any]
) -> None:
    created = add(client, headers, app_id)

    assert (
        client.patch(url(app_id, created["id"]), json=payload, headers=headers).status_code == 422
    )


def test_interview_under_wrong_application_is_not_found(
    client: TestClient, headers: dict[str, str], app_id: str
) -> None:
    """An interview id only works under the application it belongs to."""
    other_app = client.post(
        "/api/v1/applications", json={"company": "Beta", "role_title": "Dev"}, headers=headers
    ).json()["id"]
    interview = add(client, headers, app_id)

    assert client.get(url(other_app, interview["id"]), headers=headers).status_code == 404


@pytest.mark.parametrize(
    ("method", "with_interview"),
    [("GET", False), ("POST", False), ("GET", True), ("PATCH", True), ("DELETE", True)],
)
def test_other_users_get_not_found(
    client: TestClient,
    auth: AuthHelper,
    headers: dict[str, str],
    app_id: str,
    method: str,
    with_interview: bool,
) -> None:
    interview = add(client, headers, app_id, notes="private")
    other = auth.headers("grace@example.com")
    target = url(app_id, interview["id"]) if with_interview else url(app_id)
    body = {"scheduled_at": "2026-10-20T14:00:00Z"} if method in ("POST", "PATCH") else None

    response = client.request(method, target, json=body, headers=other)

    assert response.status_code == 404
    assert client.get(url(app_id, interview["id"]), headers=headers).json()["notes"] == "private"
    assert len(client.get(url(app_id), headers=headers).json()) == 1


def test_unknown_ids_are_not_found(
    client: TestClient, headers: dict[str, str], app_id: str
) -> None:
    assert client.get(url(str(uuid.uuid4())), headers=headers).status_code == 404
    assert client.get(url(app_id, str(uuid.uuid4())), headers=headers).status_code == 404


def test_deleting_the_application_deletes_its_interviews(
    app: FastAPI, client: TestClient, headers: dict[str, str], app_id: str
) -> None:
    add(client, headers, app_id)

    client.delete(f"/api/v1/applications/{app_id}", headers=headers)

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Interview)) == 0


def test_routes_require_login(client: TestClient, app_id: str) -> None:
    assert client.get(url(app_id)).status_code == 401
