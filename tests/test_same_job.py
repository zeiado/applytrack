from typing import Any

import pytest
from fastapi.testclient import TestClient

from applytrack.core.job_url import normalize_job_url
from tests.conftest import AuthHelper

URL = "/api/v1/applications"
SAME_JOB = f"{URL}/same-job"


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("https://acme.example/jobs/42", "https://ACME.example/jobs/42/"),
        ("https://acme.example/jobs/42", "http://www.acme.example/jobs/42#apply"),
        ("https://acme.example/jobs/42", "https://acme.example/jobs/42?utm_source=x&trk=y"),
        ("https://acme.example/jobs?id=42&lang=en", "https://acme.example/jobs?lang=en&id=42"),
        (
            "https://www.linkedin.com/jobs/view/4012345678/",
            "https://eg.linkedin.com/jobs/view/backend-engineer-at-acme-4012345678?refId=abc",
        ),
        (
            "https://www.linkedin.com/jobs/view/4012345678",
            "https://www.linkedin.com/jobs/search/?currentJobId=4012345678&keywords=python",
        ),
    ],
)
def test_links_to_the_same_job_match(a: str, b: str) -> None:
    assert normalize_job_url(a) == normalize_job_url(b)


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("https://acme.example/jobs/42", "https://acme.example/jobs/43"),
        ("https://acme.example/jobs?id=42", "https://acme.example/jobs?id=43"),
        ("https://acme.example/jobs/42", "https://other.example/jobs/42"),
        (
            "https://www.linkedin.com/jobs/view/4012345678",
            "https://www.linkedin.com/jobs/view/4012345679",
        ),
    ],
)
def test_links_to_different_jobs_dont_match(a: str, b: str) -> None:
    assert normalize_job_url(a) != normalize_job_url(b)


@pytest.mark.parametrize("url", [None, "", "   ", "not a link", "https://"])
def test_no_key_without_a_host(url: str | None) -> None:
    assert normalize_job_url(url) is None


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def save(client: TestClient, headers: dict[str, str], job_url: str | None, **extra: Any) -> str:
    body = {"company": "Acme", "role_title": "Backend Engineer", "job_url": job_url, **extra}
    response = client.post(URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def same_job(client: TestClient, headers: dict[str, str], job_url: str) -> list[dict[str, Any]]:
    response = client.get(SAME_JOB, params={"job_url": job_url}, headers=headers)
    assert response.status_code == 200, response.text
    result: list[dict[str, Any]] = response.json()
    return result


def test_finds_the_job_saved_with_another_link(client: TestClient, headers: dict[str, str]) -> None:
    first = save(client, headers, "https://www.linkedin.com/jobs/view/4012345678/")
    save(client, headers, "https://www.linkedin.com/jobs/view/999")
    save(client, headers, None)

    matches = same_job(
        client, headers, "https://www.linkedin.com/jobs/search/?currentJobId=4012345678"
    )

    assert [m["id"] for m in matches] == [first]
    assert matches[0]["company"] == "Acme"
    assert "job_description" not in matches[0]


def test_newest_first(client: TestClient, headers: dict[str, str]) -> None:
    older = save(client, headers, "https://acme.example/jobs/42")
    newer = save(client, headers, "https://acme.example/jobs/42?utm_source=linkedin")

    matches = same_job(client, headers, "https://acme.example/jobs/42/")

    assert [m["id"] for m in matches] == [newer, older]


def test_nothing_for_a_new_job(client: TestClient, headers: dict[str, str]) -> None:
    save(client, headers, "https://acme.example/jobs/42")
    assert same_job(client, headers, "https://acme.example/jobs/43") == []
    assert same_job(client, headers, "not a link") == []


def test_only_your_own_applications(
    client: TestClient, headers: dict[str, str], auth: AuthHelper
) -> None:
    save(client, auth.headers("grace@example.com"), "https://acme.example/jobs/42")
    assert same_job(client, headers, "https://acme.example/jobs/42") == []


def test_percent_and_underscore_in_links_are_plain_text(
    client: TestClient, headers: dict[str, str]
) -> None:
    save(client, headers, "https://acme.example/jobs/backend_engineer")
    assert same_job(client, headers, "https://acme.example/jobs/backend%engineer") == []
    assert len(same_job(client, headers, "https://acme.example/jobs/backend_engineer")) == 1


def test_needs_a_link_and_a_login(client: TestClient, headers: dict[str, str]) -> None:
    assert client.get(SAME_JOB, headers=headers).status_code == 422
    assert client.get(SAME_JOB, params={"job_url": ""}, headers=headers).status_code == 422
    assert client.get(SAME_JOB, params={"job_url": "https://a.example/1"}).status_code == 401
