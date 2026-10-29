import uuid
from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request, Response, status
from fastapi.responses import StreamingResponse

from applytrack.api.deps import AppAnalytics, CurrentUser, DbSession, Now
from applytrack.core.errors import ErrorResponse
from applytrack.repositories.applications import ApplicationRepository
from applytrack.schemas.applications import (
    ApplicationCreate,
    ApplicationDetail,
    ApplicationExportParams,
    ApplicationListParams,
    ApplicationRead,
    ApplicationUpdate,
    StatusChangeRead,
    StatusChangeRequest,
)
from applytrack.schemas.pagination import Page
from applytrack.services.applications import ApplicationService
from applytrack.services.export import to_csv

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
    """List your applications, filtered, sorted and paginated. Job descriptions are left
    out; get one application to read its description."""
    items, total = ApplicationService(db, user).search(params)
    return Page[ApplicationRead](
        items=[ApplicationRead.model_validate(a) for a in items],
        total=total,
        limit=params.limit,
        offset=params.offset,
    )


# Declared before /{application_id} so "export.csv" isn't parsed as an id.
@router.get(
    "/export.csv",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/csv": {}}, "description": "CSV file"}},
)
def export_applications(
    params: Annotated[ApplicationExportParams, Query()],
    request: Request,
    user: CurrentUser,
    now: Now,
) -> StreamingResponse:
    """Download your applications as CSV. Takes the same filters and sort as the list."""
    session_factory = request.app.state.session_factory
    user_id = user.id

    def chunks() -> Iterator[str]:
        # The response is sent while this runs, after the request's own session has
        # closed, so the export opens a session of its own.
        with session_factory() as session:
            rows = ApplicationRepository(session).iter_for_user(
                user_id, params.filters(), sort=params.sort
            )
            yield from to_csv(rows, bom=params.bom)

    filename = f"applications-{now.date().isoformat()}.csv"
    return StreamingResponse(
        chunks(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_application(
    body: ApplicationCreate,
    db: DbSession,
    user: CurrentUser,
    analytics: AppAnalytics,
    response: Response,
) -> ApplicationDetail:
    """Add a job application."""
    service = ApplicationService(db, user)
    application = service.create(body)
    analytics.capture(
        user.id,
        "application_created",
        {
            "status": application.status,
            "source": application.source,
            "first": service.repo.count_for_user(user.id) == 1,
        },
    )
    response.headers["Location"] = f"/api/v1/applications/{application.id}"
    return ApplicationDetail.model_validate(application)


@router.get("/{application_id}", responses=NOT_FOUND)
def get_application(
    application_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> ApplicationDetail:
    """Get one of your applications, with its job description."""
    return ApplicationDetail.model_validate(ApplicationService(db, user).get(application_id))


@router.patch("/{application_id}", responses=NOT_FOUND)
def update_application(
    application_id: uuid.UUID, body: ApplicationUpdate, db: DbSession, user: CurrentUser
) -> ApplicationDetail:
    """Change some fields of an application. Only the fields you send are updated."""
    application = ApplicationService(db, user).update(application_id, body)
    return ApplicationDetail.model_validate(application)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_application(application_id: uuid.UUID, db: DbSession, user: CurrentUser) -> None:
    """Delete an application."""
    ApplicationService(db, user).delete(application_id)


@router.post(
    "/{application_id}/status",
    responses={**NOT_FOUND, status.HTTP_409_CONFLICT: {"model": ErrorResponse}},
)
def change_status(
    application_id: uuid.UUID, body: StatusChangeRequest, db: DbSession, user: CurrentUser
) -> ApplicationDetail:
    """Move an application to a new status. Invalid moves return 409 with the allowed ones."""
    application = ApplicationService(db, user).change_status(application_id, body.status, body.note)
    return ApplicationDetail.model_validate(application)


@router.post(
    "/{application_id}/status/undo",
    responses={
        **NOT_FOUND,
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "`undo_unavailable`: no move in the last 10 minutes to take back",
        },
    },
)
def undo_status_change(
    application_id: uuid.UUID, db: DbSession, user: CurrentUser, now: Now
) -> ApplicationDetail:
    """Take back the latest status change, within 10 minutes of making it."""
    application = ApplicationService(db, user).undo_status_change(application_id, now)
    return ApplicationDetail.model_validate(application)


@router.get("/{application_id}/history", responses=NOT_FOUND)
def status_history(
    application_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> list[StatusChangeRead]:
    """Every status the application has been in, oldest first."""
    changes = ApplicationService(db, user).history(application_id)
    return [StatusChangeRead.model_validate(c) for c in changes]
