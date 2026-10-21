"""One-time links sent by email (docs/adr/0008-one-time-email-tokens.md)."""

import math
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.core.errors import AppError
from applytrack.core.security import hash_token, new_random_token
from applytrack.models import EmailToken, EmailTokenPurpose
from applytrack.repositories.email_tokens import EmailTokenRepository

RATE_WINDOW = timedelta(hours=1)

# Error codes per purpose, so a client can tell which kind of link failed.
_INVALID = {
    EmailTokenPurpose.VERIFY_EMAIL: "invalid_verification_token",
    EmailTokenPurpose.RESET_PASSWORD: "invalid_reset_token",
}
_EXPIRED = {
    EmailTokenPurpose.VERIFY_EMAIL: "verification_token_expired",
    EmailTokenPurpose.RESET_PASSWORD: "reset_token_expired",
}


class EmailTokenService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.tokens = EmailTokenRepository(session)

    def issue(
        self, user_id: uuid.UUID, purpose: EmailTokenPurpose, now: datetime, lifetime: timedelta
    ) -> str:
        """Create a token and return it. Only its hash is stored, so the raw token
        exists only in the email."""
        raw = new_random_token()
        self.tokens.add(
            EmailToken(
                user_id=user_id,
                purpose=purpose,
                token_hash=hash_token(raw),
                created_at=now,
                expires_at=now + lifetime,
            )
        )
        return raw

    def retry_after(
        self, user_id: uuid.UUID, purpose: EmailTokenPurpose, now: datetime
    ) -> int | None:
        """Seconds until this user may get another email of this kind, or None.

        Counted from the tokens in the database, so the limit holds across restarts and
        API instances, and nobody can use the API to flood someone's inbox.
        """
        limit = self.settings.email_token_limit_per_hour
        created = self.tokens.created_since(user_id, purpose, now - RATE_WINDOW)
        if len(created) < limit:
            return None
        # Allowed again once enough of the recent tokens leave the window.
        frees_up_at = created[len(created) - limit] + RATE_WINDOW
        return max(1, math.ceil((frees_up_at - now).total_seconds()))

    def consume(self, raw: str, purpose: EmailTokenPurpose, now: datetime) -> EmailToken:
        """Use a token. It, and every other unused token of the same kind for that user,
        stops working. Raises a 400 AppError if it's unknown, used or expired."""
        token = self.tokens.get_by_hash_for_update(hash_token(raw))
        if token is None or token.purpose != purpose or token.used_at is not None:
            raise AppError("This link is invalid or was already used", code=_INVALID[purpose])
        if token.expires_at <= now:
            raise AppError("This link has expired; request a new one", code=_EXPIRED[purpose])
        self.tokens.use_all(token.user_id, purpose, now)
        token.used_at = now
        return token
