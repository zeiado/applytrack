import uuid

from sqlalchemy.orm import Session

from applytrack.core.errors import NotFoundError, ValidationFailedError
from applytrack.models import Application, User
from applytrack.repositories.applications import ApplicationFilters, ApplicationRepository
from applytrack.schemas.applications import (
    ApplicationCreate,
    ApplicationListParams,
    ApplicationUpdate,
)


class ApplicationService:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user
        self.repo = ApplicationRepository(session)

    def create(self, data: ApplicationCreate) -> Application:
        application = Application(user_id=self.user.id, **data.model_dump())
        self.repo.add(application)
        self.session.commit()
        return application

    def list(self, params: ApplicationListParams) -> tuple[list[Application], int]:
        filters = ApplicationFilters(
            statuses=params.status, sources=params.source, company=params.company or None
        )
        return self.repo.list_for_user(
            self.user.id, filters, sort=params.sort, limit=params.limit, offset=params.offset
        )

    def get(self, application_id: uuid.UUID) -> Application:
        application = self.repo.get_for_user(self.user.id, application_id)
        if application is None:
            # Same answer whether it doesn't exist or belongs to someone else.
            raise NotFoundError("Application not found")
        return application

    def update(self, application_id: uuid.UUID, data: ApplicationUpdate) -> Application:
        application = self.get(application_id)
        changes = data.model_dump(exclude_unset=True)

        salary_min = changes.get("salary_min", application.salary_min)
        salary_max = changes.get("salary_max", application.salary_max)
        if salary_min is not None and salary_max is not None and salary_min > salary_max:
            raise ValidationFailedError(
                "salary_min must be less than or equal to salary_max", code="invalid_salary_range"
            )

        for field, value in changes.items():
            setattr(application, field, value)
        self.session.commit()
        return application

    def delete(self, application_id: uuid.UUID) -> None:
        self.repo.delete(self.get(application_id))
        self.session.commit()
