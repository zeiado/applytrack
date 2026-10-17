from pydantic import BaseModel, Field

from applytrack.models import ApplicationSource, ApplicationStatus


class FunnelRead(BaseModel):
    applied: int = Field(description="Applications that ever reached 'applied'")
    responded: int = Field(description="...that then got any reply, including a rejection")
    interviewed: int
    offers: int
    accepted: int


class RatesRead(BaseModel):
    """Shares of applied applications, between 0 and 1. null if nothing was applied to yet."""

    response_rate: float | None
    interview_rate: float | None
    offer_rate: float | None


class SourceStatsRead(BaseModel):
    source: ApplicationSource
    applications: int
    applied: int
    interviewed: int
    offers: int
    offer_rate: float | None


class StageDurationRead(BaseModel):
    status: ApplicationStatus
    average_days: float
    stays: int = Field(description="Completed stays the average is based on")


class StatsRead(BaseModel):
    total: int
    by_status: dict[ApplicationStatus, int]
    funnel: FunnelRead
    rates: RatesRead
    by_source: list[SourceStatsRead]
    days_in_stage: list[StageDurationRead]
