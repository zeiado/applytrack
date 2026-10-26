from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from applytrack.core.text import plain_text
from tests.conftest import AuthHelper
from tests.test_stats_api import count_queries

URL = "/api/v1/applications"


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def create(client: TestClient, headers: dict[str, str], **fields: Any) -> dict[str, Any]:
    response = client.post(
        URL, json={"company": "Acme", "role_title": "Engineer", **fields}, headers=headers
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


# --- plain_text ---------------------------------------------------------------


def test_plain_text_keeps_paragraphs_and_lists() -> None:
    html = (
        "<p>We build <strong>payments</strong>.</p><h3>You have</h3>"
        "<ul><li>3+ years of Python</li><li>SQL</li></ul>Apply<br>today"
    )
    assert plain_text(html) == (
        "We build payments.\n\nYou have\n\n- 3+ years of Python\n- SQL\n\nApply\ntoday"
    )


def test_plain_text_reads_escaped_html_and_entities() -> None:
    assert plain_text("&lt;p&gt;Salary &amp;amp; benefits&lt;/p&gt;") == "Salary & benefits"


def test_plain_text_drops_scripts_and_styles() -> None:
    html = "<div>Hi<script>alert(1)</script><style>p{}</style></div>"
    assert plain_text(html) == "Hi"


def test_plain_text_leaves_text_that_only_looks_like_markup() -> None:
    assert plain_text("Experience: <5 years, a<b") == "Experience: <5 years, a<b"


def test_plain_text_tidies_spaces_and_empty_lines() -> None:
    assert plain_text("  مطلوب   مهندس \r\n\n\n\n\tخبرة  سنتين  ") == "مطلوب مهندس\n\nخبرة سنتين"


# --- API ----------------------------------------------------------------------


def test_saved_and_returned_on_one_application(client: TestClient, headers: dict[str, str]) -> None:
    created = create(client, headers, job_description="<p>Build APIs.</p><p>Remote.</p>")

    assert created["job_description"] == "Build APIs.\n\nRemote."
    got = client.get(f"{URL}/{created['id']}", headers=headers).json()
    assert got["job_description"] == "Build APIs.\n\nRemote."


def test_lists_leave_it_out_and_dont_load_it(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    create(client, headers, job_description="A long description")

    with count_queries(app.state.engine) as statements:
        items = client.get(URL, headers=headers).json()["items"]

    assert "job_description" not in items[0]
    assert not any("job_description" in statement for statement in statements)


def test_empty_becomes_null(client: TestClient, headers: dict[str, str]) -> None:
    assert create(client, headers, job_description=" \n <p> </p> ")["job_description"] is None
    assert create(client, headers)["job_description"] is None


def test_length_limit_applies_to_the_text(client: TestClient, headers: dict[str, str]) -> None:
    # 20,000 characters of text inside more than 20,000 characters of HTML is fine.
    wrapped = "<p>" + "a" * 20_000 + "</p>"
    assert len(create(client, headers, job_description=wrapped)["job_description"]) == 20_000

    response = client.post(
        URL,
        json={"company": "A", "role_title": "B", "job_description": "a" * 20_001},
        headers=headers,
    )
    assert response.status_code == 422
    too_big = {"company": "A", "role_title": "B", "job_description": "<p>" * 40_000}
    assert client.post(URL, json=too_big, headers=headers).status_code == 422


def test_edit_and_clear(client: TestClient, headers: dict[str, str]) -> None:
    application = create(client, headers)
    path = f"{URL}/{application['id']}"

    edited = client.patch(path, json={"job_description": "New text"}, headers=headers).json()
    assert edited["job_description"] == "New text"
    untouched = client.patch(path, json={"notes": "hi"}, headers=headers).json()
    assert untouched["job_description"] == "New text"
    cleared = client.patch(path, json={"job_description": None}, headers=headers).json()
    assert cleared["job_description"] is None


def test_status_change_returns_it(client: TestClient, headers: dict[str, str]) -> None:
    application = create(client, headers, job_description="Text")

    response = client.post(
        f"{URL}/{application['id']}/status", json={"status": "screening"}, headers=headers
    )

    assert response.json()["job_description"] == "Text"


def test_in_the_account_export(client: TestClient, headers: dict[str, str]) -> None:
    create(client, headers, job_description="Text")

    exported = client.get("/api/v1/users/me/export", headers=headers).json()

    assert exported["applications"][0]["job_description"] == "Text"
