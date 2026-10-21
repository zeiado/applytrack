import uuid
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from applytrack.models import RefreshToken


class RefreshTokenRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, token: RefreshToken) -> RefreshToken:
        self.session.add(token)
        self.session.flush()
        return token

    def get_by_hash_for_update(self, token_hash: str) -> RefreshToken | None:
        """Load and lock the row, so two refreshes with one token can't both succeed."""
        return self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )

    def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    def delete_expired(self, now: datetime) -> int:
        """Delete tokens past their expiry. They can't be used, and reuse detection
        doesn't need them: an expired token is refused either way."""
        result = self.session.execute(delete(RefreshToken).where(RefreshToken.expires_at < now))
        return int(getattr(result, "rowcount", 0))
