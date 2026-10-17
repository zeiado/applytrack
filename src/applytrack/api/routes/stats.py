from dataclasses import asdict

from fastapi import APIRouter, status

from applytrack.api.deps import CurrentUser, DbSession
from applytrack.core.errors import ErrorResponse
from applytrack.repositories.stats import StatsRepository
from applytrack.schemas.stats import (
    FunnelRead,
    RatesRead,
    SourceStatsRead,
    StageDurationRead,
    StatsRead,
)
from applytrack.services.stats import compute_stats

router = APIRouter(
    prefix="/stats",
    tags=["stats"],
    responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}},
)


@router.get("")
def get_stats(db: DbSession, user: CurrentUser) -> StatsRead:
    """How your search is going: funnel, rates, results by source and time in each stage."""
    stats = compute_stats(*StatsRepository(db).snapshot(user.id))
    return StatsRead(
        total=stats.total,
        by_status=stats.by_status,
        funnel=FunnelRead(**asdict(stats.funnel)),
        rates=RatesRead(
            response_rate=stats.response_rate,
            interview_rate=stats.interview_rate,
            offer_rate=stats.offer_rate,
        ),
        by_source=[SourceStatsRead(**asdict(s)) for s in stats.by_source],
        days_in_stage=[StageDurationRead(**asdict(d)) for d in stats.days_in_stage],
    )
