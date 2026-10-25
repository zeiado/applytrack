from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from applytrack.models import Profile
from tests.conftest import AuthHelper

PROFILE = "/api/v1/users/me/profile"
ME = "/api/v1/users/me"


@pytest.fixture
def ada(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def patch(client: TestClient, headers: dict[str, str], body: dict[str, Any]) -> Any:
    return client.patch(PROFILE, json=body, headers=headers)


def test_a_new_account_has_an_empty_private_profile(
    client: TestClient, ada: dict[str, str]
) -> None:
    response = client.get(PROFILE, headers=ada)
    assert response.status_code == 200
    assert response.json() == {
        "display_name": None,
        "headline": None,
        "city": None,
        "education": None,
        "experience_level": None,
        "skills": [],
        "languages": [],
        "visibility": "private",
        "updated_at": None,
    }


def test_save_and_read_back(client: TestClient, ada: dict[str, str]) -> None:
    body = {
        "display_name": "  Ada Lovelace ",
        "headline": "Final-year computer science student",
        "city": "Cairo",
        "education": "BSc Computer Science, Cairo University, 2026",
        "experience_level": "student",
        "skills": ["Python", " SQL ", "python", "React"],
        "languages": ["Arabic", "English"],
    }
    saved = patch(client, ada, body)
    assert saved.status_code == 200, saved.text
    profile = saved.json()
    assert profile["display_name"] == "Ada Lovelace"
    assert profile["skills"] == ["Python", "SQL", "React"]  # trimmed, repeats dropped
    assert profile["visibility"] == "private"
    assert profile["updated_at"] is not None
    assert client.get(PROFILE, headers=ada).json() == profile


def test_leaving_a_field_out_keeps_it_and_empty_text_clears_it(
    client: TestClient, ada: dict[str, str]
) -> None:
    patch(client, ada, {"city": "Alexandria", "headline": "Data analyst", "skills": ["Excel"]})
    profile = patch(client, ada, {"headline": "  ", "experience_level": "junior"}).json()
    assert profile["city"] == "Alexandria"
    assert profile["headline"] is None
    assert profile["skills"] == ["Excel"]
    assert patch(client, ada, {"city": None}).json()["city"] is None


def test_open_to_recruiters_is_an_opt_in(client: TestClient, ada: dict[str, str]) -> None:
    assert patch(client, ada, {"visibility": "recruiters"}).json()["visibility"] == "recruiters"
    assert patch(client, ada, {"visibility": "private"}).json()["visibility"] == "private"


@pytest.mark.parametrize(
    "body",
    [
        {"visibility": None},
        {"skills": None},
        {"visibility": "public"},
        {"experience_level": "guru"},
        {"headline": "x" * 161},
        {"skills": ["x" * 51]},
        {"skills": [""]},
        {"skills": [f"skill {i}" for i in range(31)]},
        {"languages": [f"lang {i}" for i in range(11)]},
        {"email": "someone@else.com"},
    ],
)
def test_invalid_changes_are_refused(
    client: TestClient, ada: dict[str, str], body: dict[str, Any]
) -> None:
    response = patch(client, ada, body)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"


def test_each_user_sees_only_their_own(
    client: TestClient, auth: AuthHelper, ada: dict[str, str]
) -> None:
    patch(client, ada, {"display_name": "Ada"})
    grace = auth.headers("grace@example.com")
    assert client.get(PROFILE, headers=grace).json()["display_name"] is None


def test_needs_a_login(client: TestClient) -> None:
    assert client.get(PROFILE).status_code == 401
    assert client.patch(PROFILE, json={}).status_code == 401


def test_the_export_includes_it(client: TestClient, ada: dict[str, str]) -> None:
    patch(client, ada, {"headline": "Backend engineer", "languages": ["Arabic"]})
    export = client.get(f"{ME}/export", headers=ada).json()
    assert export["profile"]["headline"] == "Backend engineer"
    assert export["profile"]["languages"] == ["Arabic"]


def test_deleting_the_account_deletes_it(client: TestClient, ada: dict[str, str], app: Any) -> None:
    patch(client, ada, {"headline": "Backend engineer"})
    response = client.request("DELETE", ME, json={"password": "correct-horse"}, headers=ada)
    assert response.status_code == 204
    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(Profile)) == 0
