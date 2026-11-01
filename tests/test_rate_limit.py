import threading
from collections.abc import Callable, Iterator

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.rate_limit import (
    DatabaseRateLimiter,
    InMemoryRateLimiter,
    LoginRateLimiter,
    RateLimiter,
    delete_old_rate_limit_events,
)
from applytrack.db.session import build_engine, build_session_factory
from applytrack.models import Base, RateLimitEvent
from tests.conftest import TEST_DATABASE_URL


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


def limiter(clock: FakeClock, limit: int = 3, window: float = 60, **kw: int) -> InMemoryRateLimiter:
    return InMemoryRateLimiter(limit=limit, window_seconds=window, clock=clock, **kw)


Make = Callable[..., RateLimiter]
Sessions = sessionmaker[Session]


@pytest.fixture
def sessions() -> Iterator[Sessions]:
    engine = build_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    yield build_session_factory(engine)
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(params=["memory", "database"])
def make(request: pytest.FixtureRequest, clock: FakeClock) -> Make:
    """Both limiters must behave the same: the tests that take `make` run with each."""
    if request.param == "memory":
        return lambda limit=3, window=60: limiter(clock, limit=limit, window=window)
    factory: Sessions = request.getfixturevalue("sessions")
    names = iter(range(1000))

    def database(limit: int = 3, window: float = 60) -> RateLimiter:
        # A name of its own per limiter, as the app gives each limit one.
        return DatabaseRateLimiter(
            factory, name=f"test{next(names)}", limit=limit, window_seconds=window, clock=clock
        )

    return database


def test_allows_until_the_limit(make: Make) -> None:
    rl = make()

    for _ in range(2):
        rl.hit("k")
        assert rl.retry_after("k") is None
    rl.hit("k")

    assert rl.retry_after("k") == 60


def test_retry_after_counts_down_from_the_oldest_event(make: Make, clock: FakeClock) -> None:
    rl = make()
    rl.hit("k")
    clock.advance(10)
    rl.hit("k")
    rl.hit("k")

    assert rl.retry_after("k") == 50  # oldest event expires 50s from now
    clock.advance(49.5)
    assert rl.retry_after("k") == 1  # rounds up, never 0
    clock.advance(0.5)
    assert rl.retry_after("k") is None  # oldest expired: 2 events left in the window


def test_window_slides(make: Make, clock: FakeClock) -> None:
    rl = make(limit=2, window=60)
    rl.hit("k")
    clock.advance(30)
    rl.hit("k")
    assert rl.retry_after("k") == 30

    clock.advance(30)  # first event leaves the window
    assert rl.retry_after("k") is None
    rl.hit("k")
    assert rl.retry_after("k") == 30  # blocked again until the second event expires


def test_keys_are_independent(make: Make) -> None:
    rl = make(limit=1)
    rl.hit("a")

    assert rl.retry_after("a") is not None
    assert rl.retry_after("b") is None


def test_reset_forgets_a_key(make: Make) -> None:
    rl = make(limit=1)
    rl.hit("k")

    rl.reset("k")
    rl.reset("never-seen")  # no error

    assert rl.retry_after("k") is None


def test_expired_keys_are_swept(clock: FakeClock) -> None:
    rl = limiter(clock, limit=5, sweep_every=3)
    rl.hit("a")
    rl.hit("b")
    clock.advance(61)
    rl.hit("c")  # third call triggers a sweep: a and b have expired

    assert len(rl) == 1


def test_is_thread_safe(clock: FakeClock) -> None:
    rl = limiter(clock, limit=10_000)

    def work() -> None:
        for _ in range(1000):
            rl.hit("k")

    threads = [threading.Thread(target=work) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(rl._events["k"]) == 8000


def test_login_limiter_combines_both_limits(make: Make) -> None:
    login = LoginRateLimiter(per_account=make(limit=2), per_ip=make(limit=3))

    login.record_failure("1.1.1.1", "a@x.io")
    login.record_failure("1.1.1.1", "a@x.io")
    assert login.retry_after("1.1.1.1", "a@x.io") == 60  # pair limit
    assert login.retry_after("1.1.1.1", "b@x.io") is None

    login.record_failure("1.1.1.1", "b@x.io")
    assert login.retry_after("1.1.1.1", "c@x.io") == 60  # IP limit across emails
    assert login.retry_after("2.2.2.2", "a@x.io") is None  # other IPs unaffected


def test_success_resets_only_the_pair(make: Make) -> None:
    login = LoginRateLimiter(per_account=make(limit=2), per_ip=make(limit=3))
    login.record_failure("ip", "a@x.io")
    login.record_failure("ip", "a@x.io")

    login.record_success("ip", "a@x.io")

    assert login.retry_after("ip", "a@x.io") is None
    login.record_failure("ip", "b@x.io")
    assert login.retry_after("ip", "a@x.io") == 60  # IP count (3) still includes earlier failures


def db_limiter(
    sessions: Sessions, clock: FakeClock, name: str = "x", limit: int = 3
) -> DatabaseRateLimiter:
    return DatabaseRateLimiter(sessions, name=name, limit=limit, window_seconds=60, clock=clock)


def test_database_limiter_stores_no_raw_keys(sessions: Sessions, clock: FakeClock) -> None:
    db_limiter(sessions, clock, name="login_ip").hit("203.0.113.7|ada@example.com")
    with sessions() as session:
        [event] = session.scalars(select(RateLimitEvent)).all()
    assert event.limiter == "login_ip"
    assert "ada" not in event.key_hash
    assert "203.0.113.7" not in event.key_hash
    assert len(event.key_hash) == 64


def test_database_limiters_with_other_names_dont_share_counts(
    sessions: Sessions, clock: FakeClock
) -> None:
    a = db_limiter(sessions, clock, name="a", limit=1)
    b = db_limiter(sessions, clock, name="b", limit=1)
    a.hit("k")
    assert a.retry_after("k") == 60
    assert b.retry_after("k") is None


def test_database_limiter_counts_survive_a_new_instance(
    sessions: Sessions, clock: FakeClock
) -> None:
    """What a deploy or a second API process sees: the counts are in the database."""
    db_limiter(sessions, clock, limit=1).hit("k")
    assert db_limiter(sessions, clock, limit=1).retry_after("k") == 60


def test_housekeeping_deletes_events_older_than_a_day(sessions: Sessions, clock: FakeClock) -> None:
    rl = db_limiter(sessions, clock, limit=5)
    rl.hit("old")
    clock.advance(24 * 60 * 60 + 1)
    rl.hit("new")

    with sessions() as session:
        assert delete_old_rate_limit_events(session, clock()) == 1
        session.commit()
        assert session.scalar(select(func.count()).select_from(RateLimitEvent)) == 1
