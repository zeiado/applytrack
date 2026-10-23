"""Signing in with Google (#46, docs/adr/0009-sign-in-with-google.md)."""

import logging
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from applytrack.core.errors import ConflictError, ForbiddenError
from applytrack.core.google import GoogleIdentity
from applytrack.models import User
from applytrack.repositories.refresh_tokens import RefreshTokenRepository
from applytrack.repositories.users import UserRepository
from applytrack.services.auth import normalize_email

logger = logging.getLogger("applytrack.auth")


class GoogleSignInService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.users = UserRepository(session)
        # Whether the last sign_in created the account (for the sign-up event).
        self.created = False

    def sign_in(self, identity: GoogleIdentity, *, locale: str, now: datetime) -> User:
        """The user for this Google account: already linked, linked now to the account
        with the same email, or newly created."""
        if not identity.email_verified:
            # Then Google hasn't checked that the account owns the address.
            raise ForbiddenError(
                "Your Google account's email address isn't verified",
                code="google_email_not_verified",
            )
        try:
            user = self._find_or_create(identity, locale, now)
            self.session.commit()
        except IntegrityError:
            # A first sign-in with the same Google account at the same moment
            # created the user first. Use that one.
            self.session.rollback()
            user = self._find_or_create(identity, locale, now)
            self.session.commit()
        return user

    def _find_or_create(self, identity: GoogleIdentity, locale: str, now: datetime) -> User:
        user = self.users.get_by_google_subject(identity.subject)
        if user is not None:
            return user

        email = normalize_email(identity.email)
        user = self.users.get_by_email(email)
        if user is None:
            user = User(
                email=email,
                password_hash=None,
                locale=locale,
                email_verified_at=now,
                google_subject=identity.subject,
            )
            self.users.add(user)
            self.created = True
            logger.info("Account created with Google", extra={"user_id": str(user.id)})
            return user

        if user.google_subject is not None:
            raise ConflictError(
                "This email's account is linked to a different Google account",
                code="google_account_mismatch",
            )
        if not user.email_verified:
            # Anyone can register with an address they don't own, and until it's
            # verified the password may be theirs, not the owner's. Remove it and sign
            # out its sessions, or that person keeps access once the owner takes the
            # account over here. The owner can set a password with a reset email.
            user.password_hash = None
            user.password_changed_at = datetime.now(UTC)  # compared with real-clock tokens
            RefreshTokenRepository(self.session).revoke_all_for_user(user.id, now)
            user.email_verified_at = now
            logger.warning(
                "Google linked to an unverified account; password removed",
                extra={"user_id": str(user.id)},
            )
        user.google_subject = identity.subject
        self.session.flush()
        logger.info("Google account linked", extra={"user_id": str(user.id)})
        return user
