"""Search statistics. A pure function over plain data, so every number is unit-testable.

Definitions (also in docs/design.md):
- applied:    the application ever reached `applied`
- responded:  after applying, it reached screening, interviewing, offer, accepted or
              rejected (a rejection is a response; withdrawing yourself is not)
- rates:      share of *applied* applications; None when nothing has been applied to
- days in stage: average over completed stays only (entered the stage, then left it)
"""

import uuid
from collections import Counter, defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from itertools import pairwise

from applytrack.models import ApplicationSource
from applytrack.models import ApplicationStatus as S

RESPONSE_STATUSES = frozenset({S.SCREENING, S.INTERVIEWING, S.OFFER, S.ACCEPTED, S.REJECTED})
INTERVIEW_STATUSES = frozenset({S.INTERVIEWING, S.OFFER, S.ACCEPTED})
OFFER_STATUSES = frozenset({S.OFFER, S.ACCEPTED})
FINAL = frozenset({S.ACCEPTED, S.REJECTED, S.WITHDRAWN})


@dataclass(frozen=True)
class AppSnapshot:
    id: uuid.UUID
    status: S
    source: ApplicationSource


@dataclass(frozen=True)
class Change:
    application_id: uuid.UUID
    to_status: S
    changed_at: datetime


@dataclass(frozen=True)
class Funnel:
    applied: int = 0
    responded: int = 0
    interviewed: int = 0
    offers: int = 0
    accepted: int = 0


@dataclass(frozen=True)
class SourceStats:
    source: ApplicationSource
    applications: int
    applied: int
    interviewed: int
    offers: int
    offer_rate: float | None


@dataclass(frozen=True)
class StageDuration:
    status: S
    average_days: float
    stays: int


@dataclass(frozen=True)
class Stats:
    total: int
    by_status: dict[S, int]
    funnel: Funnel
    response_rate: float | None
    interview_rate: float | None
    offer_rate: float | None
    by_source: list[SourceStats] = field(default_factory=list)
    days_in_stage: list[StageDuration] = field(default_factory=list)


def rate(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def compute_stats(applications: Sequence[AppSnapshot], changes: Iterable[Change]) -> Stats:
    """`changes` must be in the order they happened (per application)."""
    history: dict[uuid.UUID, list[Change]] = defaultdict(list)
    for change in changes:
        history[change.application_id].append(change)

    reached: dict[uuid.UUID, set[S]] = {
        app.id: {c.to_status for c in history[app.id]} | {app.status} for app in applications
    }
    applied_ids = {app.id for app in applications if S.APPLIED in reached[app.id]}

    def count(ids: Iterable[uuid.UUID], statuses: frozenset[S]) -> int:
        return sum(1 for i in ids if reached[i] & statuses)

    funnel = Funnel(
        applied=len(applied_ids),
        responded=count(applied_ids, RESPONSE_STATUSES),
        interviewed=count(applied_ids, INTERVIEW_STATUSES),
        offers=count(applied_ids, OFFER_STATUSES),
        accepted=count(applied_ids, frozenset({S.ACCEPTED})),
    )

    status_counts = Counter(app.status for app in applications)
    return Stats(
        total=len(applications),
        by_status={status: status_counts.get(status, 0) for status in S},
        funnel=funnel,
        response_rate=rate(funnel.responded, funnel.applied),
        interview_rate=rate(funnel.interviewed, funnel.applied),
        offer_rate=rate(funnel.offers, funnel.applied),
        by_source=_by_source(applications, applied_ids, reached),
        days_in_stage=_days_in_stage(history),
    )


def _by_source(
    applications: Sequence[AppSnapshot],
    applied_ids: set[uuid.UUID],
    reached: dict[uuid.UUID, set[S]],
) -> list[SourceStats]:
    result = []
    for source in ApplicationSource:
        ids = [a.id for a in applications if a.source == source]
        if not ids:
            continue
        applied = [i for i in ids if i in applied_ids]
        offers = sum(1 for i in applied if reached[i] & OFFER_STATUSES)
        result.append(
            SourceStats(
                source=source,
                applications=len(ids),
                applied=len(applied),
                interviewed=sum(1 for i in applied if reached[i] & INTERVIEW_STATUSES),
                offers=offers,
                offer_rate=rate(offers, len(applied)),
            )
        )
    return result


def _days_in_stage(history: dict[uuid.UUID, list[Change]]) -> list[StageDuration]:
    stays: dict[S, list[float]] = defaultdict(list)
    for changes in history.values():
        for entered, left in pairwise(changes):
            seconds = (left.changed_at - entered.changed_at).total_seconds()
            stays[entered.to_status].append(seconds / 86_400)
    return [
        StageDuration(
            status=status,
            average_days=round(sum(stays[status]) / len(stays[status]), 1),
            stays=len(stays[status]),
        )
        for status in S
        if status not in FINAL and stays[status]
    ]
