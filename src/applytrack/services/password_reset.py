"""Password reset by email (#44, docs/adr/0008-one-time-email-tokens.md)."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.core.security import hash_password
from applytrack.mail.backends import mask_email
from applytrack.mail.mailer import Mailer
from applytrack.models import EmailTokenPurpose
from applytrack.repositories.refresh_tokens import RefreshTokenRepository
from applytrack.repositories.users import UserRepository
from applytrack.services.auth import normalize_email
from applytrack.services.email_tokens import EmailTokenService

logger = logging.getLogger("applytrack.auth")

PURPOSE = EmailTokenPurpose.RESET_PASSWORD


class PasswordResetService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.users = UserRepository(session)
        self.tokens = EmailTokenService(session, settings)

    def request(self, email: str, now: datetime) -> None:
        """Email a reset link if the account exists and hasn't had too many this hour.

        Says nothing about which happened: the caller always answers 202, so nobody
        can use this to find out whether an email has an account.
        """
        user = self.users.get_by_email(normalize_email(email))
        if user is None:
            logger.info("Password reset for unknown email", extra={"to": mask_email(email)})
            return
        if self.tokens.retry_after(user.id, PURPOSE, now) is not None:
            logger.warning("Password reset email limit reached", extra={"user_id": str(user.id)})
            return

        minutes = self.settings.password_reset_expire_minutes
        raw = self.tokens.issue(user.id, PURPOSE, now, timedelta(minutes=minutes))
        Mailer(self.session, self.settings).send(
            to=user.email,
            template="reset_password",
            locale="ar" if user.locale == "ar" else "en",
            context={
                # In the fragment (#) so it stays out of logs and Referer headers (ADR 0008).
                "link": f"{self.settings.public_app_url}/reset-password#token={raw}",
                "minutes": minutes,
            },
        )
        self.session.commit()
        logger.info("Password reset email queued", extra={"user_id": str(user.id)})

    def reset(self, raw_token: str, new_password: str, now: datetime) -> None:
        """Set a new password with a reset token, and sign the user out everywhere."""
        token = self.tokens.consume(raw_token, PURPOSE, now)
        user = self.users.get(token.user_id)
        assert user is not None  # noqa: S101 (tokens are deleted with their user)

        user.password_hash = hash_password(new_password)
        # Compared with access tokens' issue time, which uses the real clock.
        user.password_changed_at = datetime.now(UTC)
        # Opening the link proved they control the address.
        user.email_verified_at = user.email_verified_at or now
        RefreshTokenRepository(self.session).revoke_all_for_user(user.id, now)
        Mailer(self.session, self.settings).send(
            to=user.email,
            template="password_changed",
            locale="ar" if user.locale == "ar" else "en",
            context={"forgot_link": f"{self.settings.public_app_url}/forgot-password"},
        )
        self.session.commit()
        logger.info("Password reset; all sessions revoked", extra={"user_id": str(user.id)})
