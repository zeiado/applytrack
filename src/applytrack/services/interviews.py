import uuid

from sqlalchemy.orm import Session

from applytrack.core.errors import NotFoundError
from applytrack.models import Interview, User
from applytrack.repositories.interviews import InterviewRepository
from applytrack.schemas.interviews import InterviewCreate, InterviewUpdate
from applytrack.services.applications import ApplicationService


class InterviewService:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.applications = ApplicationService(session, user)
        self.repo = InterviewRepository(session)

    def list_for_application(self, application_id: uuid.UUID) -> list[Interview]:
        # ApplicationService.get raises 404 unless the application is the user's.
        return self.repo.list_for_application(self.applications.get(application_id).id)

    def create(self, application_id: uuid.UUID, data: InterviewCreate) -> Interview:
        application = self.applications.get(application_id)
        interview = Interview(application_id=application.id, **data.model_dump())
        self.repo.add(interview)
        self.session.commit()
        return interview

    def get(self, application_id: uuid.UUID, interview_id: uuid.UUID) -> Interview:
        application = self.applications.get(application_id)
        interview = self.repo.get(application.id, interview_id)
        if interview is None:
            raise NotFoundError("Interview not found")
        return interview

    def update(
        self, application_id: uuid.UUID, interview_id: uuid.UUID, data: InterviewUpdate
    ) -> Interview:
        interview = self.get(application_id, interview_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(interview, field, value)
        self.session.commit()
        return interview

    def delete(self, application_id: uuid.UUID, interview_id: uuid.UUID) -> None:
        self.repo.delete(self.get(application_id, interview_id))
        self.session.commit()
