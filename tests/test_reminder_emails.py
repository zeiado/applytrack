"""Daily follow-up reminder emails (#45) and the settings that control them."""

import logging
import threading
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from applytrack.core.config import Settings
from applytrack.jobs.worker import PeriodicTask, Worker
from applytrack.mail.backends import EmailMessage, MemoryEmailBackend
from applytrack.models import User
from applytrack.services.reminder_emails import ReminderEmailScheduler, _zone
from tests.conftest import TEST_DATABASE_URL, AuthHelper

ME = "/api/v1/users/me"
APPS = "/api/v1/applications"
CAIRO = ZoneInfo("Africa/Cairo")
TODAY = date(2026, 10, 21)


def at(hour: int, minute: int = 0, day: date = TODAY, tz: ZoneInfo = CAIRO) -> datetime:
    """A moment given in local time, as UTC (what the worker's clock returns)."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz).astimezone(UTC)


class Users:
    """Creates users and their applications through the API, like a real client."""

    def __init__(self, app: FastAPI, client: TestClient, auth: AuthHelper) -> None:
        self.app = app
        self.client = client
        self.auth = auth

    def create(
        self, email: str = "ada@example.com", *, verified: bool = True, **settings: Any
    ) -> dict[str, str]:
        headers = self.auth.headers(email)
        if settings:
            assert self.client.patch(ME, headers=headers, json=settings).status_code == 200
        if verified:
            with self.app.state.session_factory() as session:
                user = session.scalars(select(User).where(User.email == email)).one()
                user.email_verified_at = datetime.now(UTC)
                session.commit()
        return headers

    def application(
        self, headers: dict[str, str], company: str, follow_up_on: date | None, **extra: Any
    ) -> str:
        body = {"company": company, "role_title": "Backend Engineer", **extra}
        if follow_up_on:
            body["follow_up_on"] = follow_up_on.isoformat()
        response = self.client.post(APPS, headers=headers, json=body)
        assert response.status_code == 201, response.text
        app_id: str = response.json()["id"]
        return app_id

    def checked_on(self, email: str = "ada@example.com") -> date | None:
        with self.app.state.session_factory() as session:
            user = session.scalars(select(User).where(User.email == email)).one()
            checked: date | None = user.reminders_checked_on
            return checked


@pytest.fixture
def users(app: FastAPI, client: TestClient, auth: AuthHelper) -> Users:
    return Users(app, client, auth)


@pytest.fixture
def scheduler(app: FastAPI, settings: Settings) -> ReminderEmailScheduler:
    return ReminderEmailScheduler(app.state.session_factory, settings)


@pytest.fixture
def sent(worker: Worker, mailbox: MemoryEmailBackend) -> Any:
    """Run queued jobs and return the reminder emails sent so far (not the sign-up ones)."""

    def reminders() -> list[EmailMessage]:
        worker.run_pending()
        return [m for m in mailbox.outbox if "follow-up" in m.subject or "متابع" in m.subject]

    return reminders


# ---- When the email goes out -------------------------------------------------------


def test_one_email_on_the_morning_a_follow_up_is_due(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    headers = users.create()
    users.application(headers, "Valeo", TODAY)

    assert scheduler.run(at(7, 59)) == 0  # before 08:00 Cairo time
    assert scheduler.run(at(8, 0)) == 1
    assert scheduler.run(at(8, 5)) == 0  # never twice the same day
    assert scheduler.run(at(23, 59)) == 0

    [email] = sent()
    assert email.to == "ada@example.com"
    assert email.subject == "1 follow-up due today on Sekka"
    assert "- Valeo: Backend Engineer (due today)" in email.text
    assert users.checked_on() == TODAY


def test_next_morning_brings_a_new_email_if_still_due(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.application(users.create(), "Valeo", TODAY)

    scheduler.run(at(9))
    scheduler.run(at(9, day=TODAY + timedelta(days=1)))

    _, second = sent()
    assert "(1 day overdue)" in second.text
    assert users.checked_on() == TODAY + timedelta(days=1)


def test_only_open_applications_that_are_due_are_listed(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    """The same rules as GET /reminders/due: final statuses and future dates are left out."""
    headers = users.create()
    users.application(headers, "Valeo", TODAY - timedelta(days=3))
    users.application(headers, "Tomorrow Inc", TODAY + timedelta(days=1))
    users.application(headers, "No Date", None)
    rejected = users.application(headers, "Closed Co", TODAY - timedelta(days=3))
    response = users.client.post(
        f"{APPS}/{rejected}/status", headers=headers, json={"status": "rejected"}
    )
    assert response.status_code == 200, response.text

    assert scheduler.run(at(8)) == 1
    [email] = sent()
    assert "- Valeo: Backend Engineer (3 days overdue)" in email.text
    assert "Tomorrow Inc" not in email.text
    assert "No Date" not in email.text
    assert "Closed Co" not in email.text


def test_a_user_with_nothing_due_is_checked_once_a_day(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.create()

    assert scheduler.run(at(8)) == 0

    assert users.checked_on() == TODAY  # not checked again every 5 minutes
    assert sent() == []


def test_unverified_emails_get_no_reminders(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.application(users.create(verified=False), "Valeo", TODAY)

    assert scheduler.run(at(8)) == 0
    assert sent() == []
    assert users.checked_on() is None  # checked once they verify


def test_reminder_emails_can_be_turned_off(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.application(users.create(reminder_emails=False), "Valeo", TODAY)

    assert scheduler.run(at(8)) == 0
    assert sent() == []


def test_the_morning_is_in_each_users_timezone(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.application(users.create("cairo@example.com"), "Valeo", TODAY)
    users.application(users.create("ny@example.com", timezone="America/New_York"), "Stripe", TODAY)

    scheduler.run(at(8))  # 08:00 in Cairo is the middle of the night in New York
    assert [m.to for m in sent()] == ["cairo@example.com"]

    scheduler.run(at(8, tz=ZoneInfo("America/New_York")))
    assert [m.to for m in sent()] == ["cairo@example.com", "ny@example.com"]


def test_today_is_the_users_local_date(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    """At 09:00 in Tokyo it's still yesterday in UTC; Tokyo's "today" counts."""
    tokyo = ZoneInfo("Asia/Tokyo")
    users.application(users.create(timezone="Asia/Tokyo"), "Sony", TODAY)

    scheduler.run(at(9, tz=tokyo))

    assert len(sent()) == 1
    assert users.checked_on() == TODAY


def test_the_reminder_hour_is_configurable(
    users: Users, settings: Settings, scheduler: ReminderEmailScheduler
) -> None:
    settings.reminder_hour = 10
    users.application(users.create(), "Valeo", TODAY)

    assert scheduler.run(at(9, 59)) == 0
    assert scheduler.run(at(10)) == 1


# ---- What the email says -----------------------------------------------------------


def test_long_lists_are_cut_short(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any, settings: Settings
) -> None:
    headers = users.create()
    for n in range(12):
        users.application(headers, f"Company {n:02}", TODAY - timedelta(days=n))

    scheduler.run(at(8))

    [email] = sent()
    assert email.subject == "12 follow-ups due today on Sekka"
    assert email.text.count("\n- ") == 10
    assert "- Company 11: Backend Engineer (11 days overdue)" in email.text  # most overdue first
    assert "Company 01" not in email.text and "Company 00" not in email.text
    assert "...and 2 more." in email.text
    assert f"{settings.public_app_url}/reminders" in email.text
    assert f'href="{settings.public_app_url}/settings"' in email.html


def test_arabic_reminder(users: Users, scheduler: ReminderEmailScheduler, sent: Any) -> None:
    headers = users.create(locale="ar")
    users.application(headers, "فاليو", TODAY - timedelta(days=2))
    users.application(headers, "Instabug", TODAY)

    scheduler.run(at(8))

    [email] = sent()
    assert email.subject == "عندك 2 متابعات النهارده على Sekka"
    assert "- فاليو: Backend Engineer (متأخرة 2 يوم)" in email.text
    assert "(تابع النهارده)" in email.text
    assert 'dir="rtl"' in email.html


def test_company_names_are_escaped_in_html(
    users: Users, scheduler: ReminderEmailScheduler, sent: Any
) -> None:
    users.application(users.create(), "<script>x</script>", TODAY)

    scheduler.run(at(8))

    [email] = sent()
    assert "<script>" not in email.html
    assert "&lt;script&gt;" in email.html


# ---- Settings: PATCH /users/me ----------------------------------------------------


def test_update_settings(client: TestClient, auth: AuthHelper) -> None:
    headers = auth.headers()

    response = client.patch(
        ME,
        headers=headers,
        json={"timezone": "Asia/Dubai", "reminder_emails": False, "locale": "ar"},
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["timezone"], body["reminder_emails"], body["locale"]) == (
        "Asia/Dubai",
        False,
        "ar",
    )
    assert client.get(ME, headers=headers).json() == body


def test_update_settings_leaves_other_fields_alone(client: TestClient, auth: AuthHelper) -> None:
    headers = auth.headers()
    client.patch(ME, headers=headers, json={"timezone": "Asia/Dubai"})

    body = client.patch(ME, headers=headers, json={"reminder_emails": False}).json()

    assert (body["timezone"], body["reminder_emails"], body["locale"]) == (
        "Asia/Dubai",
        False,
        "en",
    )


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"timezone": "Mars/Olympus"}, "body.timezone"),
        ({"locale": "fr"}, "body.locale"),
        ({"email": "new@example.com"}, "body.email"),  # not changeable here
        ({"reminder_emails": "sometimes"}, "body.reminder_emails"),
    ],
)
def test_update_settings_validates_input(
    client: TestClient, auth: AuthHelper, body: dict[str, Any], field: str
) -> None:
    response = client.patch(ME, headers=auth.headers(), json=body)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_update_settings_rejects_null(client: TestClient, auth: AuthHelper) -> None:
    response = client.patch(ME, headers=auth.headers(), json={"timezone": None})
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "timezone can't be null"


def test_update_settings_needs_a_login(client: TestClient) -> None:
    assert client.patch(ME, json={"timezone": "UTC"}).status_code == 401


# ---- The worker runs it ------------------------------------------------------------


def test_the_worker_checks_reminders_periodically(worker: Worker, settings: Settings) -> None:
    [task] = worker.periodic
    assert task.name == "follow_up_reminders"
    assert task.every == timedelta(minutes=settings.reminder_check_minutes)


def test_periodic_tasks_run_on_their_interval_and_failures_are_contained(
    app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    now = datetime(2026, 10, 21, 6, tzinfo=UTC)
    ran: list[datetime] = []

    def broken(_: datetime) -> None:
        raise RuntimeError("boom")

    worker = Worker(
        app.state.session_factory,
        {},
        clock=lambda: now,
        periodic=[
            PeriodicTask("count", timedelta(minutes=5), ran.append),
            PeriodicTask("broken", timedelta(minutes=5), broken),
        ],
    )
    with caplog.at_level(logging.ERROR, logger="applytrack.jobs"):
        worker.run_periodic()
        worker.run_periodic()  # too soon
        now += timedelta(minutes=5)
        worker.run_periodic()

    assert ran == [datetime(2026, 10, 21, 6, tzinfo=UTC), now]
    failures = [r for r in caplog.records if r.message == "Periodic task failed"]
    assert [r.__dict__["task"] for r in failures] == ["broken", "broken"]


def test_run_forever_runs_periodic_tasks(app: FastAPI) -> None:
    ran: list[datetime] = []
    stop = threading.Event()
    worker = Worker(
        app.state.session_factory,
        {},
        periodic=[PeriodicTask("count", timedelta(minutes=5), ran.append)],
    )

    def wait(timeout: float | None = None) -> bool:
        stop.set()
        return True

    stop.wait = wait  # type: ignore[method-assign]
    worker.run_forever(stop, poll_seconds=1)

    assert len(ran) == 1


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgresql"),
    reason="row locks need PostgreSQL; SQLite has no SELECT ... FOR UPDATE",
)
def test_two_workers_at_once_send_one_email(
    users: Users, app: FastAPI, settings: Settings, sent: Any
) -> None:
    users.application(users.create(), "Valeo", TODAY)
    barrier = threading.Barrier(2)
    counts: list[int] = []

    def run() -> None:
        scheduler = ReminderEmailScheduler(app.state.session_factory, settings)
        barrier.wait()
        counts.append(scheduler.run(at(8)))

    threads = [threading.Thread(target=run) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)

    assert sorted(counts) == [0, 1]
    assert len(sent()) == 1


def test_an_unknown_stored_timezone_falls_back_to_cairo() -> None:
    """Timezones are validated on input; a bad stored one must not stop everyone's emails."""
    assert _zone("Not/AZone") == CAIRO
    assert _zone("Asia/Tokyo") == ZoneInfo("Asia/Tokyo")


def test_a_user_who_no_longer_qualifies_is_skipped(
    users: Users, app: FastAPI, scheduler: ReminderEmailScheduler
) -> None:
    """Between listing candidates and locking one, the user may turn reminders off or be
    taken by another worker; the lock query then finds nothing."""
    users.create(reminder_emails=False)
    with app.state.session_factory() as session:
        user_id = session.scalars(select(User.id)).one()

    assert scheduler._check(user_id, at(8)) is False
