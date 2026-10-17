from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event, select, update

from applytrack.models import StatusChange
from tests.conftest import AuthHelper

URL = "/api/v1/stats"


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def add(client: TestClient, headers: dict[str, str], *path: str, **fields: Any) -> str:
    """Create an application and move it along `path`."""
    response = client.post(
        "/api/v1/applications",
        json={"company": "Acme", "role_title": "Engineer", **fields},
        headers=headers,
    )
    app_id: str = response.json()["id"]
    for status in path:
        moved = client.post(
            f"/api/v1/applications/{app_id}/status", json={"status": status}, headers=headers
        )
        assert moved.status_code == 200, moved.text
    return app_id


def test_empty_stats(client: TestClient, headers: dict[str, str]) -> None:
    body = client.get(URL, headers=headers).json()

    assert body["total"] == 0
    assert body["rates"] == {"response_rate": None, "interview_rate": None, "offer_rate": None}
    assert body["funnel"] == {
        "applied": 0,
        "responded": 0,
        "interviewed": 0,
        "offers": 0,
        "accepted": 0,
    }
    assert body["by_source"] == []
    assert body["days_in_stage"] == []
    assert len(body["by_status"]) == 8 and set(body["by_status"].values()) == {0}


def test_stats_end_to_end(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "interviewing", "offer", "accepted", source="referral")
    add(client, headers, "rejected", source="job_board")
    add(client, headers, source="job_board")
    add(client, headers, status="wishlist", source="company_site")

    body = client.get(URL, headers=headers).json()

    assert body["total"] == 4
    assert body["funnel"] == {
        "applied": 3,
        "responded": 2,
        "interviewed": 1,
        "offers": 1,
        "accepted": 1,
    }
    assert body["rates"] == {
        "response_rate": 0.6667,
        "interview_rate": 0.3333,
        "offer_rate": 0.3333,
    }
    assert body["by_status"]["accepted"] == 1
    assert body["by_status"]["wishlist"] == 1
    sources = {s["source"]: s for s in body["by_source"]}
    assert sources["referral"]["offer_rate"] == 1.0
    assert sources["job_board"] == {
        "source": "job_board",
        "applications": 2,
        "applied": 2,
        "interviewed": 0,
        "offers": 0,
        "offer_rate": 0.0,
    }
    assert sources["company_site"]["offer_rate"] is None


def test_days_in_stage_uses_history_timestamps(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    app_id = add(client, headers, "screening", "interviewing")
    # Rewrite the history timestamps: applied on day 0, screening day 5, interviewing day 8.
    start = datetime(2026, 9, 1, tzinfo=UTC)
    with app.state.session_factory() as session:
        ids = session.scalars(select(StatusChange.id).order_by(StatusChange.id)).all()
        for change_id, days in zip(ids, [0, 5, 8], strict=True):
            session.execute(
                update(StatusChange)
                .where(StatusChange.id == change_id)
                .values(changed_at=start + timedelta(days=days))
            )
        session.commit()

    body = client.get(URL, headers=headers).json()

    assert body["days_in_stage"] == [
        {"status": "applied", "average_days": 5.0, "stays": 1},
        {"status": "screening", "average_days": 3.0, "stays": 1},
    ]
    assert app_id


def test_only_my_data_counts(client: TestClient, auth: AuthHelper, headers: dict[str, str]) -> None:
    add(client, headers, "rejected")
    other = auth.headers("grace@example.com")
    add(client, other, "interviewing", "offer")
    add(client, other)

    mine = client.get(URL, headers=headers).json()
    theirs = client.get(URL, headers=other).json()

    assert (mine["total"], mine["funnel"]["offers"]) == (1, 0)
    assert (theirs["total"], theirs["funnel"]["offers"]) == (2, 1)


@contextmanager
def count_queries(engine: Engine) -> Iterator[list[str]]:
    statements: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def test_query_count_does_not_grow_with_data(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    """Guards against N+1 queries: stats cost the same number of queries for 1 or 10 apps."""

    def queries_for_stats() -> int:
        with count_queries(app.state.engine) as statements:
            assert client.get(URL, headers=headers).status_code == 200
        return len(statements)

    add(client, headers, "screening")
    one = queries_for_stats()
    for _ in range(9):
        add(client, headers, "screening", "interviewing")
    ten = queries_for_stats()

    assert one == ten
    assert ten == 3  # load the logged-in user, then applications, then history


def test_requires_login(client: TestClient) -> None:
    assert client.get(URL).status_code == 401
