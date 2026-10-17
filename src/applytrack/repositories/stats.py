import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from applytrack.models import Application, StatusChange
from applytrack.services.stats import AppSnapshot, Change


class StatsRepository:
    """Loads everything stats need in two queries, however many applications there are."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def snapshot(self, user_id: uuid.UUID) -> tuple[list[AppSnapshot], list[Change]]:
        apps = [
            AppSnapshot(id=row.id, status=row.status, source=row.source)
            for row in self.session.execute(
                select(Application.id, Application.status, Application.source).where(
                    Application.user_id == user_id
                )
            )
        ]
        changes = [
            Change(
                application_id=row.application_id,
                to_status=row.to_status,
                changed_at=row.changed_at,
            )
            for row in self.session.execute(
                select(StatusChange.application_id, StatusChange.to_status, StatusChange.changed_at)
                .join(Application, Application.id == StatusChange.application_id)
                .where(Application.user_id == user_id)
                .order_by(StatusChange.application_id, StatusChange.id)
            )
        ]
        return apps, changes
