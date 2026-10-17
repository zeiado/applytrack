import threading

import pytest

from applytrack.core.rate_limit import InMemoryRateLimiter, LoginRateLimiter


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


def test_allows_until_the_limit(clock: FakeClock) -> None:
    rl = limiter(clock)

    for _ in range(2):
        rl.hit("k")
        assert rl.retry_after("k") is None
    rl.hit("k")

    assert rl.retry_after("k") == 60


def test_retry_after_counts_down_from_the_oldest_event(clock: FakeClock) -> None:
    rl = limiter(clock)
    rl.hit("k")
    clock.advance(10)
    rl.hit("k")
    rl.hit("k")

    assert rl.retry_after("k") == 50  # oldest event expires 50s from now
    clock.advance(49.5)
    assert rl.retry_after("k") == 1  # rounds up, never 0
    clock.advance(0.5)
    assert rl.retry_after("k") is None  # oldest expired: 2 events left in the window


def test_window_slides(clock: FakeClock) -> None:
    rl = limiter(clock, limit=2, window=60)
    rl.hit("k")
    clock.advance(30)
    rl.hit("k")
    assert rl.retry_after("k") == 30

    clock.advance(30)  # first event leaves the window
    assert rl.retry_after("k") is None
    rl.hit("k")
    assert rl.retry_after("k") == 30  # blocked again until the second event expires


def test_keys_are_independent(clock: FakeClock) -> None:
    rl = limiter(clock, limit=1)
    rl.hit("a")

    assert rl.retry_after("a") is not None
    assert rl.retry_after("b") is None


def test_reset_forgets_a_key(clock: FakeClock) -> None:
    rl = limiter(clock, limit=1)
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


def test_login_limiter_combines_both_limits(clock: FakeClock) -> None:
    login = LoginRateLimiter(per_account=limiter(clock, limit=2), per_ip=limiter(clock, limit=3))

    login.record_failure("1.1.1.1", "a@x.io")
    login.record_failure("1.1.1.1", "a@x.io")
    assert login.retry_after("1.1.1.1", "a@x.io") == 60  # pair limit
    assert login.retry_after("1.1.1.1", "b@x.io") is None

    login.record_failure("1.1.1.1", "b@x.io")
    assert login.retry_after("1.1.1.1", "c@x.io") == 60  # IP limit across emails
    assert login.retry_after("2.2.2.2", "a@x.io") is None  # other IPs unaffected


def test_success_resets_only_the_pair(clock: FakeClock) -> None:
    login = LoginRateLimiter(per_account=limiter(clock, limit=2), per_ip=limiter(clock, limit=3))
    login.record_failure("ip", "a@x.io")
    login.record_failure("ip", "a@x.io")

    login.record_success("ip", "a@x.io")

    assert login.retry_after("ip", "a@x.io") is None
    login.record_failure("ip", "b@x.io")
    assert login.retry_after("ip", "a@x.io") == 60  # IP count (3) still includes earlier failures
