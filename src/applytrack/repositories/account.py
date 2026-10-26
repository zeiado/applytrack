import uuid
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from applytrack.models import Application, Interview, StatusChange, User


@dataclass(frozen=True)
class AccountData:
    """Everything one user owns, grouped by application."""

    applications: list[Application]
    history: dict[uuid.UUID, list[StatusChange]]
    interviews: dict[uuid.UUID, list[Interview]]


class AccountRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def load_all(self, user_id: uuid.UUID) -> AccountData:
        """Three queries however many applications there are (no N+1)."""
        applications = list(
            self.session.scalars(
                select(Application)
                .options(undefer(Application.job_description))
                .where(Application.user_id == user_id)
                .order_by(Application.created_at, Application.id)
            )
        )
        history: dict[uuid.UUID, list[StatusChange]] = defaultdict(list)
        for change in self.session.scalars(
            select(StatusChange)
            .join(Application, StatusChange.application_id == Application.id)
            .where(Application.user_id == user_id)
            .order_by(StatusChange.id)
        ):
            history[change.application_id].append(change)
        interviews: dict[uuid.UUID, list[Interview]] = defaultdict(list)
        for interview in self.session.scalars(
            select(Interview)
            .join(Application, Interview.application_id == Application.id)
            .where(Application.user_id == user_id)
            .order_by(Interview.scheduled_at, Interview.id)
        ):
            interviews[interview.application_id].append(interview)
        return AccountData(applications, history, interviews)

    def delete_user(self, user: User) -> None:
        """Delete the user. The database cascades to everything they own."""
        self.session.delete(user)
        self.session.flush()
