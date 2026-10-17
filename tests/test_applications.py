import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from applytrack.models import Application, User
from tests.conftest import AuthHelper

URL = "/api/v1/applications"

FULL_APPLICATION = {
    "company": "Acme",
    "role_title": "Backend Engineer",
    "job_url": "https://acme.example/jobs/42",
    "source": "referral",
    "status": "wishlist",
    "salary_min": 90000,
    "salary_max": 120000,
    "applied_on": "2026-10-01",
    "follow_up_on": "2026-10-08",
    "notes": "Referred by Sam",
}


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


@pytest.fixture
def other_headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("grace@example.com")


def create(client: TestClient, headers: dict[str, str], **overrides: Any) -> dict[str, Any]:
    payload = {"company": "Acme", "role_title": "Backend Engineer", **overrides}
    response = client.post(URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# --- Create -----------------------------------------------------------------


def test_create_with_all_fields(client: TestClient, headers: dict[str, str]) -> None:
    response = client.post(URL, json=FULL_APPLICATION, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert response.headers["location"] == f"{URL}/{body['id']}"
    assert {k: body[k] for k in FULL_APPLICATION} == FULL_APPLICATION
    assert body["created_at"] and body["updated_at"]


def test_create_with_only_required_fields_uses_defaults(
    client: TestClient, headers: dict[str, str]
) -> None:
    body = create(client, headers, company="  Acme  ")

    assert body["company"] == "Acme"  # whitespace stripped
    assert body["status"] == "applied"
    assert body["source"] == "other"
    assert body["job_url"] is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"company": ""}, "body.company"),
        ({"company": "   "}, "body.company"),
        ({"role_title": "x" * 201}, "body.role_title"),
        ({"job_url": "not a url"}, "body.job_url"),
        ({"source": "carrier_pigeon"}, "body.source"),
        ({"status": "offer"}, "body.status"),  # can't start at a late stage
        ({"salary_min": -1}, "body.salary_min"),
        ({"salary_min": 200, "salary_max": 100}, "body"),
        ({"applied_on": "yesterday"}, "body.applied_on"),
        ({"user_id": str(uuid.uuid4())}, "body.user_id"),  # can't set owner
    ],
    ids=[
        "empty-company",
        "blank-company",
        "long-role",
        "bad-url",
        "bad-source",
        "late-status",
        "negative-salary",
        "salary-range",
        "bad-date",
        "extra-field",
    ],
)
def test_create_rejects_invalid_input(
    client: TestClient, headers: dict[str, str], overrides: dict[str, Any], field: str
) -> None:
    payload = {"company": "Acme", "role_title": "Backend Engineer", **overrides}

    response = client.post(URL, json=payload, headers=headers)

    assert response.status_code == 422
    assert field in [d["field"] for d in response.json()["error"]["details"]]


# --- Read -------------------------------------------------------------------


def test_get_returns_own_application(client: TestClient, headers: dict[str, str]) -> None:
    created = create(client, headers)

    response = client.get(f"{URL}/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_id_is_not_found(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(f"{URL}/{uuid.uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_malformed_id_is_validation_error(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(f"{URL}/not-a-uuid", headers=headers)

    assert response.status_code == 422


# --- Update -----------------------------------------------------------------


def test_patch_changes_only_sent_fields(client: TestClient, headers: dict[str, str]) -> None:
    created = create(
        client, headers, **{k: v for k, v in FULL_APPLICATION.items() if k != "status"}
    )

    response = client.patch(
        f"{URL}/{created['id']}",
        json={"notes": "Call back Monday", "job_url": None},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["notes"] == "Call back Monday"
    assert body["job_url"] is None  # explicit null clears it
    assert body["company"] == created["company"]  # untouched
    assert body["salary_max"] == created["salary_max"]
    assert body["updated_at"] >= created["updated_at"]


def test_patch_checks_salary_range_against_stored_values(
    client: TestClient, headers: dict[str, str]
) -> None:
    created = create(client, headers, salary_min=90000, salary_max=120000)

    response = client.patch(f"{URL}/{created['id']}", json={"salary_min": 150000}, headers=headers)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_salary_range"


@pytest.mark.parametrize(
    "payload",
    [{"company": None}, {"role_title": None}, {"source": None}, {"status": "offer"}],
    ids=["null-company", "null-role", "null-source", "status-not-patchable"],
)
def test_patch_rejects_invalid_changes(
    client: TestClient, headers: dict[str, str], payload: dict[str, Any]
) -> None:
    created = create(client, headers)

    response = client.patch(f"{URL}/{created['id']}", json=payload, headers=headers)

    assert response.status_code == 422


# --- Delete -----------------------------------------------------------------


def test_delete_removes_application(client: TestClient, headers: dict[str, str]) -> None:
    created = create(client, headers)

    response = client.delete(f"{URL}/{created['id']}", headers=headers)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"{URL}/{created['id']}", headers=headers).status_code == 404


def test_deleting_a_user_deletes_their_applications(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    create(client, headers)

    with app.state.session_factory() as session:
        session.delete(session.scalar(select(User).where(User.email == "ada@example.com")))
        session.commit()
        assert session.scalar(select(func.count()).select_from(Application)) == 0


# --- Ownership (FR-2) -------------------------------------------------------


@pytest.mark.parametrize(
    ("method", "payload"),
    [("GET", None), ("PATCH", {"notes": "hijacked"}), ("DELETE", None)],
)
def test_other_users_cannot_touch_my_application(
    client: TestClient,
    headers: dict[str, str],
    other_headers: dict[str, str],
    method: str,
    payload: dict[str, Any] | None,
) -> None:
    mine = create(client, headers, notes="original")

    response = client.request(method, f"{URL}/{mine['id']}", json=payload, headers=other_headers)

    # 404, not 403: don't reveal that the application exists.
    assert response.status_code == 404
    still_mine = client.get(f"{URL}/{mine['id']}", headers=headers)
    assert still_mine.status_code == 200
    assert still_mine.json()["notes"] == "original"


@pytest.mark.parametrize(
    ("method", "path"),
    [("POST", ""), ("GET", "/x"), ("PATCH", "/x"), ("DELETE", "/x")],
)
def test_all_routes_require_login(client: TestClient, method: str, path: str) -> None:
    path = path.replace("x", str(uuid.uuid4()))

    response = client.request(method, f"{URL}{path}", json={})

    assert response.status_code == 401
