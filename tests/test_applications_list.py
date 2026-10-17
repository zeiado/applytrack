from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import AuthHelper

URL = "/api/v1/applications"


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def add(client: TestClient, headers: dict[str, str], company: str, **fields: Any) -> str:
    payload = {"company": company, "role_title": "Engineer", **fields}
    response = client.post(URL, json=payload, headers=headers)
    assert response.status_code == 201, response.text
    application_id: str = response.json()["id"]
    return application_id


def companies(client: TestClient, headers: dict[str, str], **params: Any) -> list[str]:
    response = client.get(URL, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [a["company"] for a in response.json()["items"]]


@pytest.fixture
def seeded(client: TestClient, headers: dict[str, str]) -> None:
    """Five applications, created in this order (so created_at increases)."""
    add(client, headers, "Acme", source="referral", applied_on="2026-10-03")
    add(client, headers, "beta labs", source="job_board", status="wishlist")
    add(client, headers, "Cobalt", source="referral", applied_on="2026-10-01")
    add(client, headers, "Delta 50% Off", source="recruiter", applied_on="2026-10-02")
    add(client, headers, "Echo", source="company_site", status="wishlist")


# --- Pagination -------------------------------------------------------------


def test_empty_list(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(URL, headers=headers)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}


@pytest.mark.usefixtures("seeded")
def test_pages_cover_every_item_exactly_once(client: TestClient, headers: dict[str, str]) -> None:
    pages = [
        client.get(URL, params={"limit": 2, "offset": offset}, headers=headers).json()
        for offset in (0, 2, 4)
    ]

    assert [p["total"] for p in pages] == [5, 5, 5]
    assert [len(p["items"]) for p in pages] == [2, 2, 1]
    ids = [a["id"] for p in pages for a in p["items"]]
    assert len(ids) == len(set(ids)) == 5


@pytest.mark.usefixtures("seeded")
def test_offset_past_the_end_is_empty_but_keeps_total(
    client: TestClient, headers: dict[str, str]
) -> None:
    body = client.get(URL, params={"offset": 50}, headers=headers).json()

    assert body["items"] == []
    assert body["total"] == 5


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"sort": "salary_min"},
        {"status": "hired"},
        {"source": "pigeon"},
        {"colour": "blue"},
    ],
    ids=[
        "limit-zero",
        "limit-too-big",
        "negative-offset",
        "bad-sort",
        "bad-status",
        "bad-source",
        "unknown-param",
    ],
)
def test_invalid_query_params_are_rejected(
    client: TestClient, headers: dict[str, str], params: dict[str, Any]
) -> None:
    response = client.get(URL, params=params, headers=headers)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


# --- Filters ----------------------------------------------------------------


@pytest.mark.usefixtures("seeded")
def test_filter_by_one_status(client: TestClient, headers: dict[str, str]) -> None:
    assert sorted(companies(client, headers, status="wishlist")) == ["Echo", "beta labs"]


@pytest.mark.usefixtures("seeded")
def test_filter_by_several_statuses(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(f"{URL}?status=wishlist&status=applied", headers=headers)

    assert response.json()["total"] == 5


@pytest.mark.usefixtures("seeded")
def test_filter_by_source(client: TestClient, headers: dict[str, str]) -> None:
    assert sorted(companies(client, headers, source="referral")) == ["Acme", "Cobalt"]


@pytest.mark.usefixtures("seeded")
@pytest.mark.parametrize(
    ("search", "expected"),
    [
        ("BETA", ["beta labs"]),
        ("o", ["Cobalt", "Delta 50% Off", "Echo"]),
        ("50%", ["Delta 50% Off"]),
        ("%", ["Delta 50% Off"]),  # % is literal, not a wildcard
        ("_", []),  # so is _
        ("  acme  ", ["Acme"]),
    ],
)
def test_filter_by_company_partial_case_insensitive(
    client: TestClient, headers: dict[str, str], search: str, expected: list[str]
) -> None:
    assert sorted(companies(client, headers, company=search)) == expected


@pytest.mark.usefixtures("seeded")
def test_filters_combine(client: TestClient, headers: dict[str, str]) -> None:
    result = companies(client, headers, source="referral", company="co", status="applied")

    assert result == ["Cobalt"]


# --- Sorting ----------------------------------------------------------------


@pytest.mark.usefixtures("seeded")
@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("-created_at", ["Echo", "Delta 50% Off", "Cobalt", "beta labs", "Acme"]),
        ("created_at", ["Acme", "beta labs", "Cobalt", "Delta 50% Off", "Echo"]),
        ("company", ["Acme", "beta labs", "Cobalt", "Delta 50% Off", "Echo"]),
        ("-company", ["Echo", "Delta 50% Off", "Cobalt", "beta labs", "Acme"]),
    ],
)
def test_sorting(
    client: TestClient, headers: dict[str, str], sort: str, expected: list[str]
) -> None:
    assert companies(client, headers, sort=sort) == expected


@pytest.mark.usefixtures("seeded")
@pytest.mark.parametrize(
    ("sort", "dated"),
    [
        ("applied_on", ["Cobalt", "Delta 50% Off", "Acme"]),
        ("-applied_on", ["Acme", "Delta 50% Off", "Cobalt"]),
    ],
)
def test_sorting_by_date_puts_missing_dates_last(
    client: TestClient, headers: dict[str, str], sort: str, dated: list[str]
) -> None:
    result = companies(client, headers, sort=sort)

    assert result[:3] == dated
    assert sorted(result[3:]) == ["Echo", "beta labs"]


def test_default_sort_is_newest_first(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "Old")
    add(client, headers, "New")

    assert companies(client, headers) == ["New", "Old"]


# --- Ownership --------------------------------------------------------------


def test_list_only_shows_my_applications(
    client: TestClient, auth: AuthHelper, headers: dict[str, str]
) -> None:
    add(client, headers, "Mine")
    other = auth.headers("grace@example.com")
    add(client, other, "Theirs")

    assert companies(client, headers) == ["Mine"]
    assert companies(client, other) == ["Theirs"]


def test_list_requires_login(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
