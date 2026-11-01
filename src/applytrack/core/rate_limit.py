"""Rate limiting for failed logins and other abuse (docs/adr/0005 and 0014)."""

import hashlib
import math
import threading
import time
from collections import deque
from collections.abc import Callable
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, sessionmaker

from applytrack.models.rate_limit_event import RateLimitEvent

# Events are kept this long, longer than any window; the worker deletes older ones.
EVENT_RETENTION_SECONDS = 24 * 60 * 60


class RateLimiter(Protocol):
    """Counts events per key inside a sliding time window."""

    def retry_after(self, key: str) -> int | None:
        """Seconds until `key` may try again, or None if it isn't blocked."""

    def hit(self, key: str) -> None:
        """Record one event (a failed login) for `key`."""

    def reset(self, key: str) -> None:
        """Forget `key` (after a successful login)."""


class InMemoryRateLimiter:
    """Sliding-window log kept in this process's memory. Thread-safe.

    Correct for one server process. With several processes or servers each would keep
    its own counts, so the limit would multiply; use a shared store (Redis) then.
    """

    def __init__(
        self,
        *,
        limit: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sweep_every: int = 1000,
    ) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._sweep_every = sweep_every
        self._calls = 0

    def retry_after(self, key: str) -> int | None:
        with self._lock:
            events = self._prune(key)
            if events is None or len(events) < self.limit:
                return None
            # Blocked until the oldest event in the window expires.
            return max(1, math.ceil(events[0] + self.window - self._clock()))

    def hit(self, key: str) -> None:
        with self._lock:
            self._events.setdefault(key, deque()).append(self._clock())
            self._calls += 1
            if self._calls % self._sweep_every == 0:
                self._sweep()

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def __len__(self) -> int:
        """Number of keys currently tracked."""
        return len(self._events)

    def _prune(self, key: str) -> deque[float] | None:
        events = self._events.get(key)
        if events is None:
            return None
        cutoff = self._clock() - self.window
        while events and events[0] <= cutoff:
            events.popleft()
        if not events:
            del self._events[key]
            return None
        return events

    def _sweep(self) -> None:
        """Drop keys with no recent events, so memory doesn't grow with every email ever tried."""
        for key in list(self._events):
            self._prune(key)


class DatabaseRateLimiter:
    """Sliding-window log kept in the database, so every API process and server shares the
    counts and a deploy doesn't reset them (ADR 0014).

    Each call uses a short session of its own and commits at once: a failed login is
    still counted when the request that saw it ends in an error.
    """

    def __init__(
        self,
        session_factory: sessionmaker[Session],
        *,
        name: str,
        limit: int,
        window_seconds: float,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.session_factory = session_factory
        self.name = name
        self.limit = limit
        self.window = window_seconds
        self._clock = clock

    @staticmethod
    def _hash(key: str) -> str:
        # Keys hold emails and IP addresses; the table only needs to tell them apart.
        return hashlib.sha256(key.encode()).hexdigest()

    def retry_after(self, key: str) -> int | None:
        now = self._clock()
        with self.session_factory() as session:
            count, oldest = session.execute(
                select(func.count(), func.min(RateLimitEvent.at)).where(
                    RateLimitEvent.limiter == self.name,
                    RateLimitEvent.key_hash == self._hash(key),
                    RateLimitEvent.at > now - self.window,
                )
            ).one()
        if count < self.limit or oldest is None:
            return None
        return max(1, math.ceil(oldest + self.window - now))

    def hit(self, key: str) -> None:
        with self.session_factory() as session:
            session.add(
                RateLimitEvent(limiter=self.name, key_hash=self._hash(key), at=self._clock())
            )
            session.commit()

    def reset(self, key: str) -> None:
        with self.session_factory() as session:
            session.execute(
                delete(RateLimitEvent).where(
                    RateLimitEvent.limiter == self.name,
                    RateLimitEvent.key_hash == self._hash(key),
                )
            )
            session.commit()


def delete_old_rate_limit_events(session: Session, now: float) -> int:
    """Housekeeping: drop events older than EVENT_RETENTION_SECONDS. Returns how many."""
    result = session.execute(
        delete(RateLimitEvent).where(RateLimitEvent.at < now - EVENT_RETENTION_SECONDS)
    )
    return int(getattr(result, "rowcount", 0) or 0)


class LoginRateLimiter:
    """Two limits on failed logins: per (IP, email) pair, and per IP across all emails."""

    def __init__(self, per_account: RateLimiter, per_ip: RateLimiter) -> None:
        self.per_account = per_account
        self.per_ip = per_ip

    @staticmethod
    def _account_key(ip: str, email: str) -> str:
        return f"{ip}|{email}"

    def retry_after(self, ip: str, email: str) -> int | None:
        waits = [
            w
            for w in (
                self.per_account.retry_after(self._account_key(ip, email)),
                self.per_ip.retry_after(ip),
            )
            if w is not None
        ]
        return max(waits) if waits else None

    def record_failure(self, ip: str, email: str) -> None:
        self.per_account.hit(self._account_key(ip, email))
        self.per_ip.hit(ip)

    def record_success(self, ip: str, email: str) -> None:
        # Only the pair is reset. Failures against other emails from this IP still count.
        self.per_account.reset(self._account_key(ip, email))
