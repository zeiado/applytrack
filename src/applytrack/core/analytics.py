"""Product analytics (#70): a few events, sent from the API to PostHog. Off unless
APPLYTRACK_POSTHOG_API_KEY is set.

Sent from the server, so the browser runs no tracking script and stores no cookies.
Events name the user by their account id only: no email, no IP address (PostHog's
GeoIP lookup is off), and nothing typed into an application. See docs/privacy.md.

Events:
- ``signed_up``: ``method`` (password or google), ``locale``
- ``application_created``: ``status``, ``source``, ``first`` (their first one)
- ``active``: at most once a day per user, for daily and weekly active users
"""

import logging
import threading
import uuid
from collections.abc import Mapping
from datetime import date
from typing import Protocol

from posthog import Posthog

from applytrack.core.config import Settings

logger = logging.getLogger("applytrack.analytics")

Properties = Mapping[str, str | int | bool | None]


class Analytics(Protocol):
    def capture(self, user_id: uuid.UUID, event: str, properties: Properties | None = None) -> None:
        """Record an event. Never raises: analytics must not break a request."""

    def close(self) -> None:
        """Send what's still queued."""


class NoAnalytics:
    def capture(self, user_id: uuid.UUID, event: str, properties: Properties | None = None) -> None:
        pass

    def close(self) -> None:
        pass


class MemoryAnalytics:
    """Keeps events in ``events``. For tests."""

    def __init__(self) -> None:
        self.events: list[tuple[uuid.UUID, str, dict[str, object]]] = []

    def capture(self, user_id: uuid.UUID, event: str, properties: Properties | None = None) -> None:
        self.events.append((user_id, event, dict(properties or {})))

    def names(self) -> list[str]:
        return [name for _, name, _ in self.events]

    def close(self) -> None:
        pass


class PostHogAnalytics:
    """Queues events in memory and sends them in batches from a background thread."""

    def __init__(self, api_key: str, host: str, *, client: Posthog | None = None) -> None:
        self._client = client or Posthog(api_key, host=host, disable_geoip=True)

    def capture(self, user_id: uuid.UUID, event: str, properties: Properties | None = None) -> None:
        try:
            self._client.capture(event, distinct_id=str(user_id), properties=dict(properties or {}))
        except Exception:  # never let analytics fail a request
            logger.warning("Analytics event dropped", exc_info=True, extra={"event": event})

    def close(self) -> None:
        self._client.shutdown()


def build_analytics(settings: Settings) -> Analytics:
    if settings.posthog_api_key:
        return PostHogAnalytics(settings.posthog_api_key, settings.posthog_host)
    return NoAnalytics()


class DailyActivity:
    """Sends ``active`` the first time each user makes a request on a given day (UTC).

    Remembered per process, so with several processes a user may count more than once
    a day; PostHog's active-user counts are of unique users, so that doesn't matter."""

    def __init__(self, max_users: int = 50_000) -> None:
        self._last_seen: dict[uuid.UUID, date] = {}
        self._lock = threading.Lock()
        self._max_users = max_users

    def record(self, analytics: Analytics, user_id: uuid.UUID, today: date) -> None:
        with self._lock:
            if self._last_seen.get(user_id) == today:
                return
            if len(self._last_seen) >= self._max_users:
                self._last_seen.clear()
            self._last_seen[user_id] = today
        analytics.capture(user_id, "active")
