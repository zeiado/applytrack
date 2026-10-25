from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from applytrack.api.deps import get_now
from applytrack.models import Application, Interview, RefreshToken, StatusChange, User
from tests.conftest import AuthHelper
from tests.test_stats_api import count_queries

EXPORT = "/api/v1/users/me/export"
ME = "/api/v1/users/me"
APPS = "/api/v1/applications"
NOW = datetime(2026, 10, 21, 9, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_now(app: FastAPI) -> Iterator[None]:
    app.dependency_overrides[get_now] = lambda: NOW
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def ada(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def add_application(client: TestClient, headers: dict[str, str], company: str = "Acme") -> str:
    response = client.post(
        APPS, json={"company": company, "role_title": "Engineer"}, headers=headers
    )
    assert response.status_code == 201, response.text
    app_id: str = response.json()["id"]
    return app_id


def add_interview(client: TestClient, headers: dict[str, str], app_id: str, when: str) -> None:
    response = client.post(
        f"{APPS}/{app_id}/interviews", json={"scheduled_at": when}, headers=headers
    )
    assert response.status_code == 201, response.text


def delete_account(client: TestClient, headers: dict[str, str], password: str) -> Any:
    return client.request("DELETE", ME, json={"password": password}, headers=headers)


# --- Export -------------------------------------------------------------------


def test_export_contains_everything_about_the_user(client: TestClient, ada: dict[str, str]) -> None:
    app_id = add_application(client, ada, "Acme")
    client.post(
        f"{APPS}/{app_id}/status", json={"status": "screening", "note": "HR call"}, headers=ada
    )
    add_interview(client, ada, app_id, "2026-10-25T14:00:00+03:00")
    add_interview(client, ada, app_id, "2026-10-23T10:00:00+03:00")
    add_application(client, ada, "Globex")

    response = client.get(EXPORT, headers=ada)

    assert response.status_code == 200
    assert response.headers["content-disposition"] == (
        'attachment; filename="applytrack-export-2026-10-21.json"'
    )
    body = response.json()
    assert body["exported_at"] == "2026-10-21T09:30:00Z"
    assert body["user"]["email"] == "ada@example.com"
    assert [a["company"] for a in body["applications"]] == ["Acme", "Globex"]
    acme = body["applications"][0]
    assert [(h["from_status"], h["to_status"]) for h in acme["history"]] == [
        (None, "applied"),
        ("applied", "screening"),
    ]
    assert acme["history"][1]["note"] == "HR call"
    assert [i["scheduled_at"] for i in acme["interviews"]] == [
        "2026-10-23T07:00:00Z",  # earliest first, in UTC
        "2026-10-25T11:00:00Z",
    ]
    assert "next_statuses" in acme  # same shape as the applications API
    assert body["applications"][1]["interviews"] == []


def test_export_never_includes_other_users_data(
    client: TestClient, auth: AuthHelper, ada: dict[str, str]
) -> None:
    grace = auth.headers("grace@example.com")
    add_application(client, grace, "Grace Corp")
    add_application(client, ada, "Acme")

    body = client.get(EXPORT, headers=ada).json()

    assert [a["company"] for a in body["applications"]] == ["Acme"]


def test_export_of_an_empty_account(client: TestClient, ada: dict[str, str]) -> None:
    body = client.get(EXPORT, headers=ada).json()

    assert body["applications"] == []
    assert body["user"]["email"] == "ada@example.com"


def test_export_query_count_does_not_grow_with_data(
    app: FastAPI, client: TestClient, ada: dict[str, str]
) -> None:
    def queries() -> int:
        with count_queries(app.state.engine) as statements:
            assert client.get(EXPORT, headers=ada).status_code == 200
        return len(statements)

    add_interview(client, ada, add_application(client, ada), "2026-10-25T14:00:00+03:00")
    one = queries()
    for _ in range(9):
        add_interview(client, ada, add_application(client, ada), "2026-10-25T14:00:00+03:00")

    assert queries() == one == 5  # user, profile, applications, history, interviews


def test_export_requires_login(client: TestClient) -> None:
    assert client.get(EXPORT).status_code == 401


# --- Delete -------------------------------------------------------------------


def test_delete_removes_the_account_and_everything_it_owns(
    app: FastAPI, client: TestClient, auth: AuthHelper, ada: dict[str, str]
) -> None:
    add_interview(client, ada, add_application(client, ada), "2026-10-25T14:00:00+03:00")
    grace = auth.headers("grace@example.com")
    add_interview(client, grace, add_application(client, grace), "2026-10-25T14:00:00+03:00")

    response = delete_account(client, ada, "correct-horse")

    assert response.status_code == 204
    assert response.content == b""
    with app.state.session_factory() as session:

        def count(model: Any) -> int:
            return session.scalar(select(func.count()).select_from(model)) or 0

        # Only grace's rows are left.
        assert session.scalars(select(User.email)).all() == ["grace@example.com"]
        assert (count(Application), count(StatusChange), count(Interview)) == (1, 1, 1)
        assert count(RefreshToken) == 1


def test_after_deletion_tokens_and_password_stop_working(
    client: TestClient, ada: dict[str, str]
) -> None:
    login = client.post(
        "/api/v1/auth/login", data={"username": "ada@example.com", "password": "correct-horse"}
    ).json()

    delete_account(client, ada, "correct-horse")

    assert client.get(ME, headers=ada).status_code == 401
    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refresh.status_code == 401
    relogin = client.post(
        "/api/v1/auth/login", data={"username": "ada@example.com", "password": "correct-horse"}
    )
    assert relogin.status_code == 401


def test_the_email_can_sign_up_again_after_deletion(
    client: TestClient, auth: AuthHelper, ada: dict[str, str]
) -> None:
    delete_account(client, ada, "correct-horse")

    auth.register("ada@example.com")


def test_wrong_password_keeps_the_account(client: TestClient, ada: dict[str, str]) -> None:
    add_application(client, ada)

    response = delete_account(client, ada, "wrong-horse")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "invalid_password"
    assert client.get(APPS, headers=ada).json()["total"] == 1


def test_repeated_wrong_passwords_are_rate_limited(client: TestClient, ada: dict[str, str]) -> None:
    codes = [delete_account(client, ada, "wrong-horse").status_code for _ in range(6)]

    assert codes == [403] * 5 + [429]
    # Even the right password waits until the window passes.
    blocked = delete_account(client, ada, "correct-horse")
    assert blocked.status_code == 429
    assert "retry-after" in blocked.headers


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"password": ""},
        {"password": "x", "extra": 1},
        {"google_id_token": ""},
        {"password": "x", "google_id_token": "y"},
    ],
    ids=["missing", "empty", "extra-field", "empty-google", "both"],
)
def test_delete_validates_input(
    client: TestClient, ada: dict[str, str], payload: dict[str, Any]
) -> None:
    response = client.request("DELETE", ME, json=payload, headers=ada)

    assert response.status_code == 422


def test_delete_requires_login(client: TestClient) -> None:
    assert client.request("DELETE", ME, json={"password": "x"}).status_code == 401
