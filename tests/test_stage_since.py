"""stage_since: when an application entered its current status (for "no reply in 30 days")."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from tests.conftest import AuthHelper

URL = "/api/v1/applications"
ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def headers(auth: AuthHelper) -> dict[str, str]:
    return auth.headers("ada@example.com")


def create(client: TestClient, headers: dict[str, str], **fields: Any) -> dict[str, Any]:
    body = {"company": "Acme", "role_title": "Backend Engineer", **fields}
    response = client.post(URL, json=body, headers=headers)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def since(app: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(app["stage_since"])


def test_new_application_starts_its_stage_now(client: TestClient, headers: dict[str, str]) -> None:
    before = datetime.now(UTC)
    app = create(client, headers)
    assert before - timedelta(seconds=1) <= since(app) <= datetime.now(UTC)


def test_added_as_applied_waits_since_applied_on(
    client: TestClient, headers: dict[str, str]
) -> None:
    app = create(client, headers, applied_on="2026-09-01")
    assert since(app) == datetime(2026, 9, 1, tzinfo=UTC)

    # On the wishlist, applied_on doesn't say when the wait began.
    wish = create(client, headers, status="wishlist", applied_on="2026-09-01")
    assert since(wish).date() != datetime(2026, 9, 1).date()


def test_a_later_applied_on_doesnt_move_it_forward(
    client: TestClient, headers: dict[str, str]
) -> None:
    future = (datetime.now(UTC) + timedelta(days=3)).date().isoformat()
    app = create(client, headers, applied_on=future)
    assert since(app) <= datetime.now(UTC)


def test_moving_restarts_it_and_undo_restores_it(
    client: TestClient, headers: dict[str, str]
) -> None:
    app = create(client, headers, applied_on="2026-09-01")

    moved = client.post(f"{URL}/{app['id']}/status", json={"status": "screening"}, headers=headers)
    assert moved.status_code == 200
    assert since(moved.json()) > datetime(2026, 9, 2, tzinfo=UTC)

    undone = client.post(f"{URL}/{app['id']}/status/undo", headers=headers)
    assert undone.status_code == 200
    assert since(undone.json()) == datetime(2026, 9, 1, tzinfo=UTC)


def test_correcting_applied_on_moves_the_first_stage(
    client: TestClient, headers: dict[str, str]
) -> None:
    app = create(client, headers)
    patched = client.patch(f"{URL}/{app['id']}", json={"applied_on": "2026-08-15"}, headers=headers)
    assert since(patched.json()) == datetime(2026, 8, 15, tzinfo=UTC)

    # After a move, applied_on no longer says when the current status began.
    client.post(f"{URL}/{app['id']}/status", json={"status": "screening"}, headers=headers)
    patched = client.patch(f"{URL}/{app['id']}", json={"applied_on": "2026-08-01"}, headers=headers)
    assert since(patched.json()) > datetime(2026, 9, 1, tzinfo=UTC)


def test_listed_applications_have_it(client: TestClient, headers: dict[str, str]) -> None:
    create(client, headers, applied_on="2026-09-01")
    [item] = client.get(URL, headers=headers).json()["items"]
    assert since(item) == datetime(2026, 9, 1, tzinfo=UTC)


def test_migration_fills_it_in_for_existing_applications(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'stage.db'}"
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "7b3f9c2d4e18")

    engine = create_engine(url)
    user = "00000000000000000000000000000001"
    moved, old_applied, fresh = (
        "0000000000000000000000000000000a",
        "0000000000000000000000000000000b",
        "0000000000000000000000000000000c",
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, created_at, updated_at) "
                "VALUES (:id, 'ada@example.com', 'x', '2026-09-01 00:00:00', '2026-09-01 00:00:00')"
            ),
            {"id": user},
        )
        for app_id, status, applied_on in [
            (moved, "screening", "2026-09-01"),
            (old_applied, "applied", "2026-08-20"),
            (fresh, "wishlist", None),
        ]:
            conn.execute(
                text(
                    "INSERT INTO applications (id, user_id, company, role_title, source, status, "
                    "applied_on, created_at, updated_at) VALUES (:id, :user, 'Acme', 'Dev', "
                    "'other', :status, :applied_on, '2026-09-05 10:00:00', '2026-09-05 10:00:00')"
                ),
                {"id": app_id, "user": user, "status": status, "applied_on": applied_on},
            )
        changes = [
            (moved, None, "applied", "2026-09-05 10:00:00"),
            (moved, "applied", "screening", "2026-09-20 12:00:00"),
            (old_applied, None, "applied", "2026-09-05 10:00:00"),
        ]
        for app_id, from_status, to_status, at in changes:
            conn.execute(
                text(
                    "INSERT INTO status_changes (application_id, from_status, to_status, "
                    "changed_at) VALUES (:id, :from_status, :to_status, :at)"
                ),
                {"id": app_id, "from_status": from_status, "to_status": to_status, "at": at},
            )

    command.upgrade(config, "head")

    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, stage_since FROM applications"))
        rows: dict[str, object] = {row[0]: row[1] for row in result}
    engine.dispose()
    assert str(rows[moved]).startswith("2026-09-20 12:00:00")  # the latest move
    assert str(rows[old_applied]).startswith("2026-08-20 00:00:00")  # applied_on
    assert str(rows[fresh]).startswith("2026-09-05 10:00:00")  # no history: when added
