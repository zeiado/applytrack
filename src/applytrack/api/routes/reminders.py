from datetime import date
from typing import Annotated, cast

from fastapi import APIRouter, Query, status

from applytrack.api.deps import CurrentUser, DbSession, Now
from applytrack.core.errors import ErrorResponse
from applytrack.models import Application
from applytrack.schemas.reminders import DueReminder, DueRemindersPage, DueRemindersParams, today_in
from applytrack.services.reminders import ReminderService

router = APIRouter(
    prefix="/reminders",
    tags=["reminders"],
    responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}},
)


@router.get("/due")
def due_reminders(
    params: Annotated[DueRemindersParams, Query()], db: DbSession, user: CurrentUser, now: Now
) -> DueRemindersPage:
    """Open applications you should follow up on, most overdue first."""
    today = today_in(params.tz, now)
    items, total = ReminderService(db, user).due(
        today, within_days=params.within_days, limit=params.limit, offset=params.offset
    )
    return DueRemindersPage(
        items=[_to_reminder(a, today) for a in items],
        total=total,
        limit=params.limit,
        offset=params.offset,
        today=today,
    )


def _to_reminder(application: Application, today: date) -> DueReminder:
    follow_up_on = cast(date, application.follow_up_on)  # the query only returns rows with one
    return DueReminder(
        application_id=application.id,
        company=application.company,
        role_title=application.role_title,
        status=application.status,
        follow_up_on=follow_up_on,
        days_overdue=(today - follow_up_on).days,
    )
