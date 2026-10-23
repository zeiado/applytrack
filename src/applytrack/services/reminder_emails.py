"""Daily follow-up reminder emails (#45).

The worker calls ``ReminderEmailScheduler.run`` every few minutes. Each verified
user with reminder emails on is checked once per local day, from
``APPLYTRACK_REMINDER_HOUR`` in their timezone: if follow-ups are due, one email
lists them; if not, nothing is sent.
"""

import logging
import uuid
from datetime import date, datetime, timedelta
from typing import cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.config import Settings
from applytrack.mail.mailer import Mailer
from applytrack.models import User
from applytrack.models.user import DEFAULT_TIMEZONE
from applytrack.services.reminders import ReminderService
from applytrack.services.unsubscribe import unsubscribe_links

logger = logging.getLogger("applytrack.reminders")

# Applications listed in one email; the rest are summed up as "and N more".
MAX_LISTED = 10


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):  # validated on input; never fail the run
        return ZoneInfo(DEFAULT_TIMEZONE)


class ReminderEmailScheduler:
    def __init__(self, session_factory: sessionmaker[Session], settings: Settings) -> None:
        self.session_factory = session_factory
        self.settings = settings

    def run(self, now: datetime) -> int:
        """Check every user whose morning has come. Returns how many emails were queued."""
        with self.session_factory() as session:
            candidates = list(session.scalars(self._candidates(now).with_only_columns(User.id)))
        queued = 0
        for user_id in candidates:
            if self._check(user_id, now):
                queued += 1
        if queued:
            logger.info("Reminder emails queued", extra={"count": queued})
        return queued

    def _candidates(self, now: datetime) -> Select[User]:
        # Anyone's local date is at most one day after the UTC date, so users checked
        # on or after that are done for today wherever they are.
        latest_local_date = now.date() + timedelta(days=1)
        return select(User).where(
            User.reminder_emails.is_(True),
            User.email_verified_at.is_not(None),
            or_(
                User.reminders_checked_on.is_(None),
                User.reminders_checked_on < latest_local_date,
            ),
        )

    def _check(self, user_id: uuid.UUID, now: datetime) -> bool:
        """Check one user in their own transaction. The row is locked (and skipped by
        other workers), so two workers can't both send today's email."""
        with self.session_factory() as session:
            user = session.scalar(
                self._candidates(now).where(User.id == user_id).with_for_update(skip_locked=True)
            )
            if user is None:
                return False
            local_now = now.astimezone(_zone(user.timezone))
            today = local_now.date()
            if local_now.hour < self.settings.reminder_hour or _checked(user, today):
                return False

            items, total = ReminderService(session, user).due(today, limit=MAX_LISTED)
            user.reminders_checked_on = today
            if total:
                page_link, one_click_link = unsubscribe_links(user, self.settings)
                Mailer(session, self.settings).send(
                    to=user.email,
                    template="follow_up_reminder",
                    locale="ar" if user.locale == "ar" else "en",
                    context={
                        "total": total,
                        "more": total - len(items),
                        "items": [
                            {
                                "company": a.company,
                                "role_title": a.role_title,
                                # The query only returns rows with a follow-up date.
                                "days_overdue": (today - cast(date, a.follow_up_on)).days,
                            }
                            for a in items
                        ],
                        "link": f"{self.settings.public_app_url}/follow-ups",
                        "settings_link": f"{self.settings.public_app_url}/settings",
                        "unsubscribe_link": page_link,
                    },
                    # One-click unsubscribe (RFC 8058), which Gmail and Yahoo require.
                    headers={
                        "List-Unsubscribe": f"<{one_click_link}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                )
            session.commit()
            return total > 0


def _checked(user: User, today: date) -> bool:
    return user.reminders_checked_on is not None and user.reminders_checked_on >= today
