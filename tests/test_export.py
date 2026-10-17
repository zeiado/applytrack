import csv
import io
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from applytrack.api.deps import get_now
from applytrack.models import Application, User
from applytrack.services.export import COLUMNS, UTF8_BOM, safe_cell
from tests.conftest import AuthHelper

URL = "/api/v1/applications/export.csv"


@pytest.fixture(autouse=True)
def frozen_clock(app: FastAPI) -> Iterator[None]:
    app.dependency_overrides[get_now] = lambda: datetime(2026, 10, 17, 12, tzinfo=UTC)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def add(client: TestClient, headers: dict[str, str], company: str, **fields: Any) -> None:
    response = client.post(
        "/api/v1/applications",
        json={"company": company, "role_title": "Engineer", **fields},
        headers=headers,
    )
    assert response.status_code == 201, response.text


def export(client: TestClient, headers: dict[str, str], **params: Any) -> list[dict[str, str]]:
    response = client.get(URL, params={"bom": False, **params}, headers=headers)
    assert response.status_code == 200, response.text
    return list(csv.DictReader(io.StringIO(response.text)))


# --- safe_cell (unit) -------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, ""),
        ("Acme", "Acme"),
        ('=HYPERLINK("http://evil")', '\'=HYPERLINK("http://evil")'),
        ("+1 555", "'+1 555"),
        ("-2+3", "'-2+3"),
        ("@SUM(A1)", "'@SUM(A1)"),
        ("\tcmd", "'\tcmd"),
        ("\rcmd", "'\rcmd"),
        ("a=b", "a=b"),  # only a leading formula character matters
        (90000, "90000"),
        (Decimal("1.5"), "1.5"),
        (date(2026, 10, 1), "2026-10-01"),
        (datetime(2026, 10, 1, 9, 30, tzinfo=UTC), "2026-10-01T09:30:00+00:00"),
        (uuid.UUID(int=1), "00000000-0000-0000-0000-000000000001"),
    ],
)
def test_safe_cell(value: Any, expected: str) -> None:
    assert safe_cell(value) == expected


# --- Endpoint ---------------------------------------------------------------


def test_headers_and_filename(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(URL, headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert (
        response.headers["content-disposition"]
        == 'attachment; filename="applications-2026-10-17.csv"'
    )


def test_bom_on_by_default_and_optional(client: TestClient, headers: dict[str, str]) -> None:
    with_bom = client.get(URL, headers=headers).content.decode("utf-8")
    without = client.get(URL, params={"bom": False}, headers=headers).content.decode("utf-8")

    assert with_bom.startswith(UTF8_BOM + "id,company")
    assert without.startswith("id,company")


def test_empty_export_has_only_the_header(client: TestClient, headers: dict[str, str]) -> None:
    response = client.get(URL, params={"bom": False}, headers=headers)

    assert response.text == ",".join(COLUMNS) + "\r\n"


def test_all_columns_round_trip(client: TestClient, headers: dict[str, str]) -> None:
    add(
        client,
        headers,
        "Acme",
        job_url="https://acme.example/jobs/1",
        source="referral",
        salary_min=90000,
        salary_max=120000,
        applied_on="2026-10-01",
        follow_up_on="2026-10-08",
        notes='Line one\nLine two, with a comma and "quotes"',
    )

    [row] = export(client, headers)

    assert list(row) == list(COLUMNS)
    assert row["company"] == "Acme"
    assert row["status"] == "applied"
    assert row["source"] == "referral"
    assert (row["salary_min"], row["salary_max"]) == ("90000", "120000")
    assert (row["applied_on"], row["follow_up_on"]) == ("2026-10-01", "2026-10-08")
    assert row["notes"] == 'Line one\nLine two, with a comma and "quotes"'
    assert row["job_url"] == "https://acme.example/jobs/1"
    assert uuid.UUID(row["id"])
    assert datetime.fromisoformat(row["created_at"]).tzinfo is not None


def test_arabic_text_survives(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "شركة الأمل", notes="مقابلة يوم الأحد")

    [row] = export(client, headers)

    assert row["company"] == "شركة الأمل"
    assert row["notes"] == "مقابلة يوم الأحد"


def test_formula_injection_is_neutralised(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, '=HYPERLINK("http://evil.example","Click")', notes="@SUM(1+1)")

    [row] = export(client, headers)

    assert row["company"].startswith("'=")
    assert row["notes"] == "'@SUM(1+1)"


def test_uses_list_filters_and_sort(client: TestClient, headers: dict[str, str]) -> None:
    add(client, headers, "Beta", source="referral")
    add(client, headers, "Alpha", source="referral")
    add(client, headers, "Gamma", source="job_board")
    add(client, headers, "Delta", source="referral", status="wishlist")

    rows = export(client, headers, source="referral", status="applied", sort="company")

    assert [r["company"] for r in rows] == ["Alpha", "Beta"]


@pytest.mark.parametrize(
    "params", [{"limit": 10}, {"offset": 5}, {"sort": "salary"}, {"bom": "maybe"}]
)
def test_invalid_params_are_rejected(
    client: TestClient, headers: dict[str, str], params: dict[str, Any]
) -> None:
    assert client.get(URL, params=params, headers=headers).status_code == 422


def test_only_my_applications(
    client: TestClient, auth: AuthHelper, headers: dict[str, str]
) -> None:
    add(client, headers, "Mine")
    add(client, auth.headers("grace@example.com"), "Theirs")

    assert [r["company"] for r in export(client, headers)] == ["Mine"]


def test_requires_login(client: TestClient) -> None:
    assert client.get(URL).status_code == 401


def test_large_export_spans_several_batches(
    app: FastAPI, client: TestClient, headers: dict[str, str]
) -> None:
    """1,200 rows is more than two 500-row batches."""
    with app.state.session_factory() as session:
        user = session.scalar(select(User).where(User.email == "ada@example.com"))
        assert user is not None
        session.add_all(
            Application(user_id=user.id, company=f"Company {i:04d}", role_title="Dev")
            for i in range(1200)
        )
        session.commit()

    rows = export(client, headers, sort="company")

    assert len(rows) == 1200
    assert rows[0]["company"] == "Company 0000"
    assert rows[-1]["company"] == "Company 1199"
    assert len({r["id"] for r in rows}) == 1200
