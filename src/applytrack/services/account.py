"""Data export and account deletion (Egypt PDPL 151/2020: access and erasure)."""

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from applytrack.core.errors import ForbiddenError
from applytrack.core.google import GoogleIdentity
from applytrack.core.security import verify_password
from applytrack.models import User
from applytrack.repositories.account import AccountRepository
from applytrack.schemas.account import AccountExport, ExportedApplication
from applytrack.schemas.applications import ApplicationRead, StatusChangeRead
from applytrack.schemas.auth import UserRead
from applytrack.schemas.interviews import InterviewRead
from applytrack.services.profiles import ProfileService

logger = logging.getLogger("applytrack.account")


class AccountService:
    def __init__(self, session: Session, user: User) -> None:
        self.session = session
        self.user = user
        self.repo = AccountRepository(session)

    def export(self, now: datetime) -> AccountExport:
        data = self.repo.load_all(self.user.id)
        applications = [
            ExportedApplication(
                **ApplicationRead.model_validate(app).model_dump(exclude={"next_statuses"}),
                history=[StatusChangeRead.model_validate(c) for c in data.history[app.id]],
                interviews=[InterviewRead.model_validate(i) for i in data.interviews[app.id]],
            )
            for app in data.applications
        ]
        return AccountExport(
            exported_at=now,
            user=UserRead.model_validate(self.user),
            profile=ProfileService(self.session, self.user).read(),
            applications=applications,
        )

    def delete(self, *, password: str | None = None, google: GoogleIdentity | None = None) -> None:
        """Delete the account and everything in it. Needs the current password, or a
        fresh sign-in with the Google account linked to it."""
        if google is not None:
            if google.subject != self.user.google_subject:
                raise ForbiddenError(
                    "That isn't the Google account linked to this account",
                    code="wrong_google_account",
                )
        elif not verify_password(password or "", self.user.password_hash):
            raise ForbiddenError("Incorrect password", code="invalid_password")
        user_id = self.user.id
        self.repo.delete_user(self.user)
        self.session.commit()
        logger.info("Account deleted", extra={"user_id": str(user_id)})
