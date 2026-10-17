import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Query, Response, status

from applytrack.api.deps import CurrentUser, DbSession
from applytrack.core.errors import ErrorResponse
from applytrack.schemas.applications import (
    ApplicationCreate,
    ApplicationListParams,
    ApplicationRead,
    ApplicationUpdate,
)
from applytrack.schemas.pagination import Page
from applytrack.services.applications import ApplicationService

router = APIRouter(
    prefix="/applications",
    tags=["applications"],
    responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}},
)
NOT_FOUND: dict[int | str, dict[str, Any]] = {status.HTTP_404_NOT_FOUND: {"model": ErrorResponse}}


@router.get("")
def list_applications(
    params: Annotated[ApplicationListParams, Query()], db: DbSession, user: CurrentUser
) -> Page[ApplicationRead]:
    """List your applications, filtered, sorted and paginated."""
    items, total = ApplicationService(db, user).list(params)
    return Page[ApplicationRead](
        items=[ApplicationRead.model_validate(a) for a in items],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate, db: DbSession, user: CurrentUser, response: Response
) -> ApplicationRead:
    """Add a job application."""
    application = ApplicationService(db, user).create(body)
    response.headers["Location"] = f"/api/v1/applications/{application.id}"
    return ApplicationRead.model_validate(application)


@router.get("/{application_id}", responses=NOT_FOUND)
def get_application(application_id: uuid.UUID, db: DbSession, user: CurrentUser) -> ApplicationRead:
    """Get one of your applications."""
    return ApplicationRead.model_validate(ApplicationService(db, user).get(application_id))


@router.patch("/{application_id}", responses=NOT_FOUND)
def update_application(
    application_id: uuid.UUID, body: ApplicationUpdate, db: DbSession, user: CurrentUser
) -> ApplicationRead:
    """Change some fields of an application. Only the fields you send are updated."""
    application = ApplicationService(db, user).update(application_id, body)
    return ApplicationRead.model_validate(application)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_application(application_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    """Delete an application."""
    ApplicationService(db, user).delete(application_id)
