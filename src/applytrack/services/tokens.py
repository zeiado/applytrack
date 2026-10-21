"""Issuing, rotating and revoking refresh tokens (see docs/adr/0006-rotating-refresh-tokens.md)."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.core.errors import UnauthorizedError
from applytrack.core.security import create_access_token, hash_token, new_random_token
from applytrack.models import RefreshToken
from applytrack.repositories.refresh_tokens import RefreshTokenRepository

logger = logging.getLogger("applytrack.auth")


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


class TokenService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.tokens = RefreshTokenRepository(session)

    def issue(self, user_id: uuid.UUID, now: datetime) -> TokenPair:
        """Start a new session (a new token family) for a user who just logged in."""
        pair = self._issue(user_id, family_id=uuid.uuid4(), now=now)
        self.session.commit()
        return pair

    def refresh(self, raw_token: str, now: datetime) -> TokenPair:
        """Exchange a refresh token for a new pair. The used token stops working."""
        token = self.tokens.get_by_hash_for_update(hash_token(raw_token))
        if token is None:
            raise UnauthorizedError("Invalid refresh token", code="invalid_refresh_token")

        if token.revoked_at is not None:
            # A used or logged-out token came back: someone may have stolen it.
            # Sign the user out everywhere; they log in again with their password.
            self.tokens.revoke_all_for_user(token.user_id, now)
            self.session.commit()
            logger.warning(
                "Revoked refresh token reused; revoked all sessions",
                extra={"user_id": str(token.user_id)},
            )
            raise UnauthorizedError("Invalid refresh token", code="refresh_token_reused")

        if token.expires_at <= now:
            raise UnauthorizedError("Refresh token has expired", code="refresh_token_expired")

        token.revoked_at = now
        pair = self._issue(token.user_id, family_id=token.family_id, now=now)
        self.session.commit()
        return pair

    def logout(self, raw_token: str, now: datetime) -> None:
        """Revoke one refresh token. Unknown or already revoked tokens are ignored."""
        token = self.tokens.get_by_hash_for_update(hash_token(raw_token))
        if token is not None and token.revoked_at is None:
            token.revoked_at = now
            self.session.commit()

    def _issue(self, user_id: uuid.UUID, *, family_id: uuid.UUID, now: datetime) -> TokenPair:
        raw = new_random_token()
        self.tokens.add(
            RefreshToken(
                user_id=user_id,
                family_id=family_id,
                token_hash=hash_token(raw),
                created_at=now,
                expires_at=now + timedelta(days=self.settings.refresh_token_expire_days),
            )
        )
        # The access token uses the real clock, like the JWT check that verifies it.
        return TokenPair(
            access_token=create_access_token(user_id, self.settings),
            refresh_token=raw,
        )
