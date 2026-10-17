"""Table-driven tests for the status workflow: every (from, to) pair is checked."""

import itertools

import pytest

from applytrack.core.errors import ConflictError
from applytrack.models import ApplicationStatus as S
from applytrack.services.workflow import (
    ALLOWED_TRANSITIONS,
    FINAL_STATUSES,
    ensure_can_transition,
    next_statuses,
)

# Written out independently of the implementation, so a change to the rules must
# be made in two places on purpose.
EXPECTED_ALLOWED = {
    (S.WISHLIST, S.APPLIED),
    (S.WISHLIST, S.WITHDRAWN),
    (S.APPLIED, S.SCREENING),
    (S.APPLIED, S.INTERVIEWING),
    (S.APPLIED, S.REJECTED),
    (S.APPLIED, S.WITHDRAWN),
    (S.SCREENING, S.INTERVIEWING),
    (S.SCREENING, S.REJECTED),
    (S.SCREENING, S.WITHDRAWN),
    (S.INTERVIEWING, S.OFFER),
    (S.INTERVIEWING, S.REJECTED),
    (S.INTERVIEWING, S.WITHDRAWN),
    (S.OFFER, S.ACCEPTED),
    (S.OFFER, S.REJECTED),
    (S.OFFER, S.WITHDRAWN),
}

ALL_PAIRS = list(itertools.product(S, S))


@pytest.mark.parametrize(("current", "target"), ALL_PAIRS, ids=[f"{a}->{b}" for a, b in ALL_PAIRS])
def test_every_transition(current: S, target: S) -> None:
    if (current, target) in EXPECTED_ALLOWED:
        ensure_can_transition(current, target)  # does not raise
    else:
        with pytest.raises(ConflictError) as exc_info:
            ensure_can_transition(current, target)
        assert exc_info.value.code == "invalid_transition"


def test_every_status_has_rules() -> None:
    assert set(ALLOWED_TRANSITIONS) == set(S)


def test_final_statuses_are_dead_ends() -> None:
    assert {s for s in S if not ALLOWED_TRANSITIONS[s]} == FINAL_STATUSES


@pytest.mark.parametrize("status", sorted(set(S) - FINAL_STATUSES))
def test_any_open_application_can_be_withdrawn(status: S) -> None:
    ensure_can_transition(status, S.WITHDRAWN)


def test_next_statuses_are_in_pipeline_order() -> None:
    assert next_statuses(S.APPLIED) == [S.SCREENING, S.INTERVIEWING, S.REJECTED, S.WITHDRAWN]
    assert next_statuses(S.REJECTED) == []


@pytest.mark.parametrize(
    ("current", "target", "message"),
    [
        (S.APPLIED, S.APPLIED, "Application is already applied"),
        (S.REJECTED, S.APPLIED, "Cannot move from rejected: it is a final status"),
        (
            S.WISHLIST,
            S.OFFER,
            "Cannot move from wishlist to offer. Allowed: applied, withdrawn",
        ),
    ],
)
def test_error_messages_explain_why(current: S, target: S, message: str) -> None:
    with pytest.raises(ConflictError, match=f"^{message}$"):
        ensure_can_transition(current, target)
