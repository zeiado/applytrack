"""The application status workflow. Pure functions, no I/O, so the rules are easy to test.

    wishlist ──► applied ──► screening ──► interviewing ──► offer ──► accepted
                    │  └─────────────────────►┘ │              │
                    └──────────┴────────────────┴──────────────┴──► rejected
    any non-final status ──► withdrawn

Skipping screening (applied → interviewing) is allowed: many companies don't have one.
Declining an offer is `offer → withdrawn`; an offer rescinded by the company is `offer → rejected`.
"""

from types import MappingProxyType

from applytrack.core.errors import ConflictError
from applytrack.models import ApplicationStatus as S

FINAL_STATUSES = frozenset({S.ACCEPTED, S.REJECTED, S.WITHDRAWN})

ALLOWED_TRANSITIONS: MappingProxyType[S, frozenset[S]] = MappingProxyType(
    {
        S.WISHLIST: frozenset({S.APPLIED, S.WITHDRAWN}),
        S.APPLIED: frozenset({S.SCREENING, S.INTERVIEWING, S.REJECTED, S.WITHDRAWN}),
        S.SCREENING: frozenset({S.INTERVIEWING, S.REJECTED, S.WITHDRAWN}),
        S.INTERVIEWING: frozenset({S.OFFER, S.REJECTED, S.WITHDRAWN}),
        S.OFFER: frozenset({S.ACCEPTED, S.REJECTED, S.WITHDRAWN}),
        S.ACCEPTED: frozenset(),
        S.REJECTED: frozenset(),
        S.WITHDRAWN: frozenset(),
    }
)


def next_statuses(current: S) -> list[S]:
    """Statuses reachable from `current`, in pipeline order."""
    allowed = ALLOWED_TRANSITIONS[current]
    return [status for status in S if status in allowed]


def ensure_can_transition(current: S, target: S) -> None:
    """Raise ConflictError (409 invalid_transition) if `current → target` isn't allowed."""
    if target in ALLOWED_TRANSITIONS[current]:
        return
    if current == target:
        message = f"Application is already {current.value}"
    elif current in FINAL_STATUSES:
        message = f"Cannot move from {current.value}: it is a final status"
    else:
        allowed = ", ".join(s.value for s in next_statuses(current))
        message = f"Cannot move from {current.value} to {target.value}. Allowed: {allowed}"
    raise ConflictError(
        message,
        code="invalid_transition",
        details=[
            {
                "from": current.value,
                "to": target.value,
                "allowed": [s.value for s in next_statuses(current)],
            }
        ],
    )
