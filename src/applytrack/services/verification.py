"""Email verification (#43)."""

import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.core.errors import ConflictError, TooManyRequestsError
from applytrack.mail.mailer import Mailer
from applytrack.models import EmailTokenPurpose, User
from applytrack.repositories.users import UserRepository
from applytrack.services.email_tokens import EmailTokenService

logger = logging.getLogger("applytrack.auth")

PURPOSE = EmailTokenPurpose.VERIFY_EMAIL


class EmailVerificationService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.tokens = EmailTokenService(session, settings)

    def queue_email(self, user: User, now: datetime) -> None:
        """Queue a verification email in the caller's transaction (the caller commits)."""
        hours = self.settings.email_verification_expire_hours
        raw = self.tokens.issue(user.id, PURPOSE, now, timedelta(hours=hours))
        Mailer(self.session, self.settings).send(
            to=user.email,
            template="verify_email",
            locale="ar" if user.locale == "ar" else "en",
            context={
                # In the fragment (#), so the token never reaches a server log or a
                # Referer header. The web app reads it and POSTs it to /auth/verify-email.
                "link": f"{self.settings.public_app_url}/verify-email#token={raw}",
                "hours": hours,
            },
        )

    def resend(self, user: User, now: datetime) -> None:
        if user.email_verified:
            raise ConflictError("Your email is already verified", code="email_already_verified")
        wait = self.tokens.retry_after(user.id, PURPOSE, now)
        if wait is not None:
            raise TooManyRequestsError(
                f"Too many verification emails. Try again in {wait} seconds.",
                retry_after=wait,
                code="too_many_emails",
            )
        self.queue_email(user, now)
        self.session.commit()

    def verify(self, raw_token: str, now: datetime) -> None:
        token = self.tokens.consume(raw_token, PURPOSE, now)
        user = UserRepository(self.session).get(token.user_id)
        assert user is not None  # noqa: S101 (tokens are deleted with their user)
        user.email_verified_at = user.email_verified_at or now
        self.session.commit()
        logger.info("Email verified", extra={"user_id": str(user.id)})
