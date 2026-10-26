"""Uploaded CVs (#115, docs/adr/0011-object-storage-for-cvs.md).

1. ``start_upload`` saves the CV as ``uploading`` and returns a signed upload link.
2. The browser uploads the file straight to storage.
3. ``complete_upload`` checks the file is there and queues reading its text.
4. The worker reads the text: the CV becomes ``ready``, or ``failed`` with a reason.

Files are deleted from storage on the job queue, so a storage hiccup never blocks
deleting a CV or an account.
"""

import logging
import uuid
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from applytrack.core.errors import (
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
    ValidationFailedError,
)
from applytrack.jobs.queue import enqueue
from applytrack.jobs.worker import JobContext, PermanentJobError
from applytrack.models import CV, CVStatus, User
from applytrack.schemas.cvs import (
    MAX_CV_BYTES,
    CVDetail,
    CVDownload,
    CVRead,
    CVUploadRequest,
    CVUploadStart,
    UploadInstructions,
)
from applytrack.services.cv_text import UnreadableCV, extract_text
from applytrack.storage import ObjectStorage, StorageError

logger = logging.getLogger("applytrack.cvs")

MAX_CVS = 3
UPLOAD_LINK_TTL = timedelta(minutes=10)
DOWNLOAD_LINK_TTL = timedelta(minutes=5)
# Uploads never completed are deleted by the worker after this long.
ABANDONED_AFTER = timedelta(hours=1)

EXTRACT_CV_TEXT = "extract_cv_text"
DELETE_STORED_FILE = "delete_stored_file"
FILE_JOB_ATTEMPTS = 8  # with backoff, about four hours of retries


class CVService:
    def __init__(self, session: Session, user: User, storage: ObjectStorage | None) -> None:
        self.session = session
        self.user = user
        self._storage = storage

    @property
    def storage(self) -> ObjectStorage:
        if self._storage is None:
            raise ServiceUnavailableError(
                "CV uploads aren't set up on this server", code="uploads_unavailable"
            )
        return self._storage

    def list_all(self) -> list[CVRead]:
        return [CVRead.model_validate(cv) for cv in self._all()]

    def read(self, cv_id: uuid.UUID) -> CVDetail:
        return CVDetail.model_validate(self._get(cv_id))

    def start_upload(self, body: CVUploadRequest, now: datetime) -> CVUploadStart:
        storage = self.storage
        # Uploads whose link has expired can't finish; they don't count toward the limit.
        expired = [
            cv
            for cv in self._all()
            if cv.status == CVStatus.UPLOADING and cv.created_at < now - UPLOAD_LINK_TTL
        ]
        discard(self.session, expired)
        replaced = self._get(body.replaces) if body.replaces else None
        counted = select(func.count()).select_from(CV).where(CV.user_id == self.user.id)
        if replaced is not None:
            counted = counted.where(CV.id != replaced.id)
        count = self.session.scalar(counted)
        if (count or 0) >= MAX_CVS:
            raise ConflictError(
                f"You can keep up to {MAX_CVS} CVs. Delete one first.", code="too_many_cvs"
            )
        cv_id = uuid.uuid4()
        cv = CV(
            id=cv_id,
            user_id=self.user.id,
            filename=body.filename,
            content_type=body.content_type,
            size_bytes=body.size_bytes,
            storage_key=f"cvs/{cv_id.hex}",
            status=CVStatus.UPLOADING,
            replaces_id=replaced.id if replaced else None,
            created_at=now,
        )
        self.session.add(cv)
        link = storage.upload_link(
            cv.storage_key,
            content_type=cv.content_type,
            size=cv.size_bytes,
            expires=UPLOAD_LINK_TTL,
        )
        self.session.commit()
        return CVUploadStart(
            cv=CVRead.model_validate(cv),
            upload=UploadInstructions(
                url=link.url, headers=link.headers, expires_at=now + UPLOAD_LINK_TTL
            ),
        )

    def complete_upload(self, cv_id: uuid.UUID) -> CVRead:
        """Called once the browser has uploaded the file: checks it, then queues reading it."""
        storage = self.storage
        cv = self._get(cv_id)
        if cv.status != CVStatus.UPLOADING:
            raise ConflictError("This CV was already uploaded", code="already_uploaded")
        try:
            size = storage.size(cv.storage_key)
        except StorageError as exc:
            logger.warning("Storage unavailable", extra={"error": str(exc)})
            raise ServiceUnavailableError(
                "Storage can't be reached. Try again in a minute.", code="storage_unavailable"
            ) from exc
        if size is None:
            raise ValidationFailedError("The file hasn't been uploaded yet", code="upload_missing")
        if size != cv.size_bytes or size > MAX_CV_BYTES:
            # The signed link prevents this; if it happens anyway, drop the file.
            discard(self.session, [cv])
            self.session.commit()
            raise ValidationFailedError(
                "The uploaded file isn't the one announced", code="upload_invalid"
            )
        cv.status = CVStatus.PROCESSING
        if cv.replaces_id is not None:
            old = self.session.get(CV, cv.replaces_id)
            cv.replaces_id = None
            if old is not None and old.user_id == self.user.id:
                discard(self.session, [old])
        enqueue(
            self.session, EXTRACT_CV_TEXT, {"cv_id": str(cv.id)}, max_attempts=FILE_JOB_ATTEMPTS
        )
        self.session.commit()
        return CVRead.model_validate(cv)

    def download_link(self, cv_id: uuid.UUID, now: datetime) -> CVDownload:
        storage = self.storage
        cv = self._get(cv_id)
        if cv.status == CVStatus.UPLOADING:
            raise ConflictError("This CV hasn't been uploaded yet", code="not_uploaded")
        url = storage.download_link(cv.storage_key, filename=cv.filename, expires=DOWNLOAD_LINK_TTL)
        return CVDownload(url=url, expires_at=now + DOWNLOAD_LINK_TTL)

    def delete(self, cv_id: uuid.UUID) -> None:
        discard(self.session, [self._get(cv_id)])
        self.session.commit()

    def _all(self) -> list[CV]:
        return list(
            self.session.scalars(
                select(CV).where(CV.user_id == self.user.id).order_by(CV.created_at, CV.id)
            )
        )

    def _get(self, cv_id: uuid.UUID) -> CV:
        cv = self.session.get(CV, cv_id)
        if cv is None or cv.user_id != self.user.id:
            raise NotFoundError("CV not found", code="cv_not_found")
        return cv


def queue_file_deletions(session: Session, cvs: Iterable[CV]) -> None:
    """Queue deleting the CVs' files. Committed with the caller's transaction."""
    for cv in cvs:
        enqueue(
            session,
            DELETE_STORED_FILE,
            {"key": cv.storage_key},
            max_attempts=FILE_JOB_ATTEMPTS,
        )


def discard(session: Session, cvs: list[CV]) -> None:
    """Delete the CVs and queue deleting their files."""
    queue_file_deletions(session, cvs)
    for cv in cvs:
        session.delete(cv)
    session.flush()


class ExtractCVTextHandler:
    """Job: read an uploaded CV's text."""

    def __init__(self, session_factory: sessionmaker[Session], storage: ObjectStorage) -> None:
        self.session_factory = session_factory
        self.storage = storage

    def __call__(self, payload: dict[str, Any], job: JobContext) -> None:
        try:
            cv_id = uuid.UUID(payload["cv_id"])
        except (KeyError, ValueError, TypeError) as exc:
            raise PermanentJobError("Bad payload") from exc
        with self.session_factory() as session:
            cv = session.get(CV, cv_id)
            if cv is None or cv.status != CVStatus.PROCESSING:
                return  # deleted meanwhile
            key, content_type = cv.storage_key, cv.content_type
        try:
            data = self.storage.read(key)
        except StorageError:
            if job.attempt >= job.max_attempts:
                self._finish(cv_id, None, "storage_error")
            raise
        if len(data) > MAX_CV_BYTES:
            self._finish(cv_id, None, "unreadable")
            return
        try:
            self._finish(cv_id, extract_text(data, content_type), None)
        except UnreadableCV as exc:
            self._finish(cv_id, None, exc.code)

    def _finish(self, cv_id: uuid.UUID, text: str | None, error: str | None) -> None:
        with self.session_factory() as session:
            cv = session.get(CV, cv_id)
            if cv is None or cv.status != CVStatus.PROCESSING:
                return
            cv.status = CVStatus.FAILED if error else CVStatus.READY
            cv.text = text
            cv.error = error
            session.commit()
        logger.info("CV read", extra={"cv_id": str(cv_id), "outcome": error or "ready"})


class DeleteStoredFileHandler:
    """Job: delete a file from storage."""

    def __init__(self, storage: ObjectStorage) -> None:
        self.storage = storage

    def __call__(self, payload: dict[str, Any], job: JobContext) -> None:
        try:
            self.storage.delete(payload["key"])
        except (KeyError, ValueError, TypeError) as exc:
            raise PermanentJobError("Bad payload") from exc


class AbandonedUploadCleaner:
    """Periodic task: delete CVs whose upload was started but never finished."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self.session_factory = session_factory

    def run(self, now: datetime) -> int:
        with self.session_factory() as session:
            abandoned = list(
                session.scalars(
                    select(CV)
                    .where(CV.status == CVStatus.UPLOADING, CV.created_at < now - ABANDONED_AFTER)
                    .limit(500)
                )
            )
            discard(session, abandoned)
            session.commit()
        if abandoned:
            logger.info("Deleted abandoned uploads", extra={"count": len(abandoned)})
        return len(abandoned)
