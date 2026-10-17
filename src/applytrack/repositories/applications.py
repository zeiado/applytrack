import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from applytrack.models import Application


class ApplicationRepository:
    """Every query is scoped to a user, so one user can never load another's data."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_for_user(self, user_id: uuid.UUID, application_id: uuid.UUID) -> Application | None:
        return self.session.scalar(
            select(Application).where(
                Application.id == application_id, Application.user_id == user_id
            )
        )

    def add(self, application: Application) -> Application:
        self.session.add(application)
        self.session.flush()
        return application

    def delete(self, application: Application) -> None:
        self.session.delete(application)
        self.session.flush()
