from datetime import date, timedelta

from sqlalchemy.orm import Session

from applytrack.models import Application, User
from applytrack.repositories.applications import ApplicationRepository
from applytrack.services.workflow import FINAL_STATUSES


class ReminderService:
    def __init__(self, session: Session, user: User) -> None:
        self.user = user
        self.repo = ApplicationRepository(session)

    def due(
        self, today: date, *, within_days: int = 0, limit: int = 20, offset: int = 0
    ) -> tuple[list[Application], int]:
        """Open applications whose follow-up date is today or earlier (or within N days).

        Applications in a final status (accepted, rejected, withdrawn) never need a follow-up.
        """
        return self.repo.due_for_follow_up(
            self.user.id,
            on_or_before=today + timedelta(days=within_days),
            exclude_statuses=sorted(FINAL_STATUSES),
            limit=limit,
            offset=offset,
        )
