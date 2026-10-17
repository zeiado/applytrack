import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from applytrack.models import Interview


class InterviewRepository:
    """Queries take the application id; callers check the application belongs to the user first."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_for_application(self, application_id: uuid.UUID) -> list[Interview]:
        return list(
            self.session.scalars(
                select(Interview)
                .where(Interview.application_id == application_id)
                .order_by(Interview.scheduled_at, Interview.id)
            )
        )

    def get(self, application_id: uuid.UUID, interview_id: uuid.UUID) -> Interview | None:
        return self.session.scalar(
            select(Interview).where(
                Interview.id == interview_id, Interview.application_id == application_id
            )
        )

    def add(self, interview: Interview) -> Interview:
        self.session.add(interview)
        self.session.flush()
        return interview

    def delete(self, interview: Interview) -> None:
        self.session.delete(interview)
        self.session.flush()
