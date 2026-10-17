"""compute_stats on hand-made data: every expected number can be checked by hand."""

import uuid
from datetime import UTC, datetime, timedelta

from applytrack.models import ApplicationSource as Src
from applytrack.models import ApplicationStatus as S
from applytrack.services.stats import AppSnapshot, Change, Funnel, compute_stats, rate

DAY0 = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)


def journey(source: Src, *steps: tuple[S, float]) -> tuple[AppSnapshot, list[Change]]:
    """An application that moved through `steps`: (status, days after DAY0)."""
    app_id = uuid.uuid4()
    changes = [Change(app_id, status, DAY0 + timedelta(days=d)) for status, d in steps]
    return AppSnapshot(app_id, steps[-1][0], source), changes


def build(*journeys: tuple[AppSnapshot, list[Change]]) -> tuple[list[AppSnapshot], list[Change]]:
    return [j[0] for j in journeys], [c for j in journeys for c in j[1]]


def test_no_applications() -> None:
    stats = compute_stats([], [])

    assert stats.total == 0
    assert set(stats.by_status.values()) == {0}
    assert stats.funnel == Funnel()
    assert (stats.response_rate, stats.interview_rate, stats.offer_rate) == (None, None, None)
    assert stats.by_source == []
    assert stats.days_in_stage == []


def test_rate_rounds_and_handles_zero() -> None:
    assert rate(1, 3) == 0.3333
    assert rate(0, 5) == 0.0
    assert rate(3, 0) is None


def test_funnel_and_rates() -> None:
    apps, changes = build(
        # 1. hired: applied → screening → interviewing → offer → accepted
        journey(
            Src.REFERRAL,
            (S.APPLIED, 0),
            (S.SCREENING, 3),
            (S.INTERVIEWING, 10),
            (S.OFFER, 20),
            (S.ACCEPTED, 22),
        ),
        # 2. rejected after applying (still a response)
        journey(Src.JOB_BOARD, (S.APPLIED, 0), (S.REJECTED, 14)),
        # 3. ghosted: applied, no reply
        journey(Src.JOB_BOARD, (S.APPLIED, 0)),
        # 4. withdrew myself after applying (not a response)
        journey(Src.JOB_BOARD, (S.APPLIED, 0), (S.WITHDRAWN, 5)),
        # 5. wishlist only (never applied, so not in any rate)
        journey(Src.COMPANY_SITE, (S.WISHLIST, 0)),
    )

    stats = compute_stats(apps, changes)

    assert stats.total == 5
    assert stats.funnel == Funnel(applied=4, responded=2, interviewed=1, offers=1, accepted=1)
    assert stats.response_rate == 0.5
    assert stats.interview_rate == 0.25
    assert stats.offer_rate == 0.25
    assert stats.by_status[S.ACCEPTED] == 1
    assert stats.by_status[S.APPLIED] == 1
    assert stats.by_status[S.WISHLIST] == 1
    assert stats.by_status[S.OFFER] == 0


def test_by_source() -> None:
    apps, changes = build(
        journey(Src.REFERRAL, (S.APPLIED, 0), (S.INTERVIEWING, 5), (S.OFFER, 9)),
        journey(Src.REFERRAL, (S.APPLIED, 0), (S.INTERVIEWING, 5)),
        journey(Src.JOB_BOARD, (S.APPLIED, 0)),
        journey(Src.JOB_BOARD, (S.APPLIED, 0)),
        journey(Src.JOB_BOARD, (S.APPLIED, 0), (S.REJECTED, 2)),
        journey(Src.RECRUITER, (S.WISHLIST, 0)),
    )

    by_source = {s.source: s for s in compute_stats(apps, changes).by_source}

    assert set(by_source) == {Src.REFERRAL, Src.JOB_BOARD, Src.RECRUITER}  # only sources in use
    referral = by_source[Src.REFERRAL]
    assert (referral.applications, referral.applied, referral.interviewed, referral.offers) == (
        2,
        2,
        2,
        1,
    )
    assert referral.offer_rate == 0.5
    assert by_source[Src.JOB_BOARD].offer_rate == 0.0
    recruiter = by_source[Src.RECRUITER]
    assert (recruiter.applications, recruiter.applied, recruiter.offer_rate) == (1, 0, None)


def test_days_in_stage_averages_completed_stays() -> None:
    apps, changes = build(
        journey(Src.OTHER, (S.APPLIED, 0), (S.SCREENING, 4), (S.INTERVIEWING, 6)),
        journey(Src.OTHER, (S.APPLIED, 0), (S.SCREENING, 10), (S.REJECTED, 13)),
        journey(Src.OTHER, (S.APPLIED, 0)),  # still in applied: not a completed stay
    )

    durations = {d.status: d for d in compute_stats(apps, changes).days_in_stage}

    assert set(durations) == {S.APPLIED, S.SCREENING}
    assert (durations[S.APPLIED].average_days, durations[S.APPLIED].stays) == (7.0, 2)  # (4+10)/2
    assert (durations[S.SCREENING].average_days, durations[S.SCREENING].stays) == (
        2.5,
        2,
    )  # (2+3)/2


def test_partial_days_are_kept() -> None:
    apps, changes = build(journey(Src.OTHER, (S.APPLIED, 0), (S.SCREENING, 1.25)))

    [duration] = compute_stats(apps, changes).days_in_stage

    assert duration.average_days == 1.2  # 1.25 rounded to 1 decimal (banker's rounding)


def test_current_status_counts_as_reached_even_without_history() -> None:
    """Defensive: an application whose history is missing still counts by its status."""
    app = AppSnapshot(uuid.uuid4(), S.APPLIED, Src.OTHER)

    stats = compute_stats([app], [])

    assert stats.funnel.applied == 1
