import uuid
from datetime import UTC, datetime, time, timedelta

from sqlalchemy.orm import Session

from applytrack.core.errors import ConflictError, NotFoundError, ValidationFailedError
from applytrack.core.job_url import normalize_job_url
from applytrack.models import Application, ApplicationStatus, StatusChange, User
from applytrack.repositories.applications import ApplicationRepository
from applytrack.schemas.applications import (
    ApplicationCreate,
    ApplicationListParams,
    ApplicationUpdate,
)
from applytrack.services.workflow import ensure_can_transition

# How long after a move "Undo" still works (the web app shows it in a toast).
UNDO_WINDOW = timedelta(minutes=10)


def first_stage_since(application: Application, added_at: datetime) -> datetime:
    """When the application's first status began. One added as "applied" with an earlier
    applied_on has been waiting since that day, not since it was typed into Sekka."""
    if application.status == ApplicationStatus.APPLIED and application.applied_on is not None:
        applied = datetime.combine(application.applied_on, time(), tzinfo=UTC)
        if applied < added_at:
            return applied
    return added_at


class ApplicationService:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user
        self.repo = ApplicationRepository(session)

    def create(self, data: ApplicationCreate) -> Application:
        application = Application(user_id=self.user.id, **data.model_dump())
        self.repo.add(application)
        # The first history entry records the starting status.
        first = StatusChange(
            application_id=application.id, from_status=None, to_status=application.status
        )
        self.repo.add_status_change(first)
        application.stage_since = first_stage_since(application, first.changed_at)
        self.session.commit()
        return application

    def search(self, params: ApplicationListParams) -> tuple[list[Application], int]:
        return self.repo.list_for_user(
            self.user.id,
            params.filters(),
            sort=params.sort,
            limit=params.limit,
            offset=params.offset,
        )

    def with_same_job_url(self, url: str, limit: int = 5) -> list[Application]:
        """Applications already saved with a link to the same job, newest first."""
        key = normalize_job_url(url)
        if key is None:
            return []
        # Any link to the job contains the last part of its path (often the job's id).
        # Narrow the rows by that in SQL, then compare the links properly.
        hint = key.split("?", 1)[0].rsplit("/", 1)[-1] or key.split("/", 1)[0]
        candidates = self.repo.with_job_url_containing(self.user.id, hint)
        return [a for a in candidates if normalize_job_url(a.job_url) == key][:limit]

    def get(self, application_id: uuid.UUID, *, for_update: bool = False) -> Application:
        application = self.repo.get_for_user(self.user.id, application_id, for_update=for_update)
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
        if "applied_on" in changes:
            # A corrected applied_on moves the start of the first status, if it's still that.
            history = self.repo.history(application.id)
            if len(history) == 1:
                application.stage_since = first_stage_since(application, history[0].changed_at)
        self.session.commit()
        return application

    def change_status(
        self, application_id: uuid.UUID, target: ApplicationStatus, note: str | None = None
    ) -> Application:
        application = self.get(application_id, for_update=True)
        ensure_can_transition(application.status, target)

        change = StatusChange(
            application_id=application.id,
            from_status=application.status,
            to_status=target,
            note=note,
        )
        self.repo.add_status_change(change)
        application.status = target
        application.stage_since = change.changed_at
        self.session.commit()
        return application

    def undo_status_change(self, application_id: uuid.UUID, now: datetime) -> Application:
        """Take back the latest move, if it's less than UNDO_WINDOW old.

        The move's history row goes too, so the history and the time-in-stage stats read as
        if it never happened. The first row (the application being added) can't be undone.
        """
        application = self.get(application_id, for_update=True)
        changes = self.repo.history(application.id)
        last = changes[-1] if changes else None
        if last is None or last.from_status is None or now - last.changed_at > UNDO_WINDOW:
            raise ConflictError("There is no recent status change to undo", code="undo_unavailable")
        application.status = last.from_status
        self.repo.remove_status_change(last)
        # Back in the previous status, since the move that put it there.
        previous = changes[-2]
        application.stage_since = (
            first_stage_since(application, previous.changed_at)
            if previous.from_status is None
            else previous.changed_at
        )
        self.session.commit()
        return application

    def history(self, application_id: uuid.UUID) -> list[StatusChange]:
        return self.repo.history(self.get(application_id).id)

    def delete(self, application_id: uuid.UUID) -> None:
        self.repo.delete(self.get(application_id))
        self.session.commit()
