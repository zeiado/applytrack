import uuid
from datetime import date, datetime
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from applytrack.models import ApplicationStatus
from applytrack.schemas.pagination import MAX_PAGE_SIZE, Page


def _valid_timezone(name: str) -> str:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown timezone {name!r}; use an IANA name like Africa/Cairo") from exc
    return name


Timezone = Annotated[str, Field(max_length=64), AfterValidator(_valid_timezone)]


class DueRemindersParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tz: Timezone = Field(
        default="UTC", description="Your timezone (IANA name), used to decide what 'today' is"
    )
    within_days: int = Field(
        default=0, ge=0, le=30, description="Also include follow-ups due in the next N days"
    )
    limit: int = Field(default=20, ge=1, le=MAX_PAGE_SIZE)
    offset: int = Field(default=0, ge=0)


class DueReminder(BaseModel):
    application_id: uuid.UUID
    company: str
    role_title: str
    status: ApplicationStatus
    follow_up_on: date
    days_overdue: int = Field(description="0 = due today; negative = due in the future")


class DueRemindersPage(Page[DueReminder]):
    today: date = Field(description="'Today' in the requested timezone")


def today_in(tz: str, now: datetime) -> date:
    return now.astimezone(ZoneInfo(tz)).date()
