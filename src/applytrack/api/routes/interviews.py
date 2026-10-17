import uuid

from fastapi import APIRouter, Response, status

from applytrack.api.deps import CurrentUser, DbSession
from applytrack.core.errors import ErrorResponse
from applytrack.schemas.interviews import InterviewCreate, InterviewRead, InterviewUpdate
from applytrack.services.interviews import InterviewService

router = APIRouter(
    prefix="/applications/{application_id}/interviews",
    tags=["interviews"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
    },
)


@router.get("")
def list_interviews(
    application_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> list[InterviewRead]:
    """Interviews for one application, earliest first."""
    interviews = InterviewService(db, user).list_for_application(application_id)
    return [InterviewRead.model_validate(i) for i in interviews]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_interview(
    application_id: uuid.UUID,
    body: InterviewCreate,
    db: DbSession,
    user: CurrentUser,
    response: Response,
) -> InterviewRead:
    """Log an interview."""
    interview = InterviewService(db, user).create(application_id, body)
    response.headers["Location"] = (
        f"/api/v1/applications/{application_id}/interviews/{interview.id}"
    )
    return InterviewRead.model_validate(interview)


@router.get("/{interview_id}")
def get_interview(
    application_id: uuid.UUID, interview_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> InterviewRead:
    return InterviewRead.model_validate(
        InterviewService(db, user).get(application_id, interview_id)
    )


@router.patch("/{interview_id}")
def update_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    body: InterviewUpdate,
    db: DbSession,
    user: CurrentUser,
) -> InterviewRead:
    """Change some fields of an interview."""
    interview = InterviewService(db, user).update(application_id, interview_id, body)
    return InterviewRead.model_validate(interview)


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(
    application_id: uuid.UUID, interview_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> None:
    InterviewService(db, user).delete(application_id, interview_id)
