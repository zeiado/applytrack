from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from applytrack.api.deps import get_now
from tests.conftest import AuthHelper

URL = "/api/v1/reminders/due"
# 23:30 UTC on Oct 17 is already 08:30 on Oct 18 in Tokyo (UTC+9, no daylight saving).
FROZEN_NOW = datetime(2026, 10, 17, 23, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_clock(app: FastAPI) -> Iterator[None]:
    app.dependency_overrides[get_now] = lambda: FROZEN_NOW
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def add(client: TestClient, headers: dict[str, str], company: str, **fields: Any) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"company": company, "role_title": "Engineer", **fields},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    app_id: str = response.json()["id"]
    return app_id


def due(client: TestClient, headers: dict[str, str], **params: Any) -> dict[str, Any]:
    response = client.get(URL, params=params, headers=headers)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_nothing_due(client: TestClient, headers: dict[str, str]) -> None:
    assert due(client, headers) == {
        "items": [],
        "total": 0,
        "limit": 20,
        "offset": 0,
        "today": "2026-10-17",
    }


def test_due_today_and_overdue_most_overdue_first(
    client: TestClient, headers: dict[str, str]
) -> None:
    add(client, headers, "Today", follow_up_on="2026-10-17")
    add(client, headers, "Last week", follow_up_on="2026-10-10")
    add(client, headers, "Tomorrow", follow_up_on="2026-10-18")
    add(client, headers, "No date")

    body = due(client, headers)

    assert [(r["company"], r["days_overdue"]) for r in body["items"]] == [
        ("Last week", 7),
        ("Today", 0),
    ]
    assert body["total"] == 2


def test_item_shape(client: TestClient, headers: dict[str, str]) -> None:
    app_id = add(client, headers, "Acme", follow_up_on="2026-10-15", status="wishlist")

    [item] = due(client, headers)["items"]

    assert item == {
        "application_id": app_id,
        "company": "Acme",
        "role_title": "Engineer",
        "status": "wishlist",
        "follow_up_on": "2026-10-15",
        "days_overdue": 2,
    }


@pytest.mark.parametrize("final_status", ["rejected", "withdrawn"])
def test_closed_applications_are_excluded(
    client: TestClient, headers: dict[str, str], final_status: str
) -> None:
    app_id = add(client, headers, "Closed", follow_up_on="2026-10-01")
    add(client, headers, "Open", follow_up_on="2026-10-01")
    client.post(
        f"/api/v1/applications/{app_id}/status", json={"status": final_status}, headers=headers
    )

    assert [r["company"] for r in due(client, headers)["items"]] == ["Open"]


def test_accepted_applications_are_excluded(client: TestClient, headers: dict[str, str]) -> None:
    app_id = add(client, headers, "Hired", follow_up_on="2026-10-01")
    for status in ["interviewing", "offer", "accepted"]:
        client.post(
            f"/api/v1/applications/{app_id}/status", json={"status": status}, headers=headers
        )

    assert due(client, headers)["total"] == 0


def test_within_days_includes_upcoming(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "In 3 days", follow_up_on="2026-10-20")
    add(client, headers, "In 4 days", follow_up_on="2026-10-21")

    items = due(client, headers, within_days=3)["items"]

    assert [(r["company"], r["days_overdue"]) for r in items] == [("In 3 days", -3)]


def test_today_depends_on_timezone(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "Due Oct 18", follow_up_on="2026-10-18")

    utc = due(client, headers)
    tokyo = due(client, headers, tz="Asia/Tokyo")

    assert (utc["today"], utc["total"]) == ("2026-10-17", 0)
    assert (tokyo["today"], tokyo["total"]) == ("2026-10-18", 1)


def test_pagination(client: TestClient, headers: dict[str, str]) -> None:
    for day in range(1, 6):
        add(client, headers, f"Day {day}", follow_up_on=f"2026-10-0{day}")

    body = due(client, headers, limit=2, offset=2)

    assert [r["company"] for r in body["items"]] == ["Day 3", "Day 4"]
    assert body["total"] == 5


@pytest.mark.parametrize(
    "params",
    [
        {"tz": "Mars/Olympus"},
        {"tz": "../../etc/passwd"},
        {"within_days": 31},
        {"within_days": -1},
        {"limit": 0},
        {"x": 1},
    ],
    ids=["unknown-tz", "path-tz", "too-many-days", "negative-days", "zero-limit", "unknown-param"],
)
def test_invalid_params(
    client: TestClient, headers: dict[str, str], params: dict[str, Any]
) -> None:
    response = client.get(URL, params=params, headers=headers)

    assert response.status_code == 422


def test_only_my_reminders(client: TestClient, auth: AuthHelper, headers: dict[str, str]) -> None:
    add(client, headers, "Mine", follow_up_on="2026-10-01")
    add(client, auth.headers("grace@example.com"), "Theirs", follow_up_on="2026-10-01")

    assert [r["company"] for r in due(client, headers)["items"]] == ["Mine"]


def test_requires_login(client: TestClient) -> None:
    assert client.get(URL).status_code == 401


def test_real_clock_is_used_without_override(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    app.dependency_overrides.clear()

    body = due(client, headers)

    assert body["today"] == datetime.now(UTC).date().isoformat()
