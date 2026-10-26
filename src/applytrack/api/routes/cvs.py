import uuid
from typing import Any

from fastapi import APIRouter, Response, status

from applytrack.api.deps import CurrentUser, DbSession, Now, Storage
from applytrack.core.errors import ErrorResponse
from applytrack.schemas.cvs import CVDetail, CVDownload, CVRead, CVUploadRequest, CVUploadStart
from applytrack.services.cvs import CVService

router = APIRouter(
    prefix="/cvs",
    tags=["cvs"],
    responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}},
)

_NOT_FOUND: dict[int | str, dict[str, Any]] = {
    status.HTTP_404_NOT_FOUND: {"model": ErrorResponse, "description": "`cv_not_found`"}
}
_UNAVAILABLE: dict[int | str, dict[str, Any]] = {
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "model": ErrorResponse,
        "description": "`uploads_unavailable` or `storage_unavailable`",
    }
}


@router.get("")
def list_cvs(user: CurrentUser, db: DbSession, storage: Storage) -> list[CVRead]:
    """Your CVs, oldest first (at most 3)."""
    return CVService(db, user, storage).list_all()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_409_CONFLICT: {"model": ErrorResponse, "description": "`too_many_cvs`"},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": ErrorResponse},
        **_UNAVAILABLE,
    },
)
def start_cv_upload(
    body: CVUploadRequest, user: CurrentUser, db: DbSession, storage: Storage, now: Now
) -> CVUploadStart:
    """Start uploading a CV (PDF or Word, up to 5 MB).

    PUT the file to `upload.url` with `upload.headers` before `upload.expires_at`, then
    call `POST /cvs/{id}/complete`.
    """
    return CVService(db, user, storage).start_upload(body, now)


@router.post(
    "/{cv_id}/complete",
    responses={
        **_NOT_FOUND,
        status.HTTP_409_CONFLICT: {"model": ErrorResponse, "description": "`already_uploaded`"},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": ErrorResponse,
            "description": "`upload_missing` or `upload_invalid`",
        },
        **_UNAVAILABLE,
    },
)
def complete_cv_upload(
    cv_id: uuid.UUID, user: CurrentUser, db: DbSession, storage: Storage
) -> CVRead:
    """The file is uploaded: Sekka reads its text in the background (status `processing`,
    then `ready` or `failed`)."""
    return CVService(db, user, storage).complete_upload(cv_id)


@router.get("/{cv_id}", responses=_NOT_FOUND)
def read_cv(cv_id: uuid.UUID, user: CurrentUser, db: DbSession, storage: Storage) -> CVDetail:
    """A CV with the text read from it."""
    return CVService(db, user, storage).read(cv_id)


@router.get(
    "/{cv_id}/download",
    responses={
        **_NOT_FOUND,
        status.HTTP_409_CONFLICT: {"model": ErrorResponse, "description": "`not_uploaded`"},
        **_UNAVAILABLE,
    },
)
def download_cv(
    cv_id: uuid.UUID, user: CurrentUser, db: DbSession, storage: Storage, now: Now
) -> CVDownload:
    """A link that downloads the file, valid for 5 minutes."""
    return CVService(db, user, storage).download_link(cv_id, now)


@router.delete("/{cv_id}", status_code=status.HTTP_204_NO_CONTENT, responses=_NOT_FOUND)
def delete_cv(cv_id: uuid.UUID, user: CurrentUser, db: DbSession, storage: Storage) -> Response:
    """Delete a CV and its file."""
    CVService(db, user, storage).delete(cv_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
