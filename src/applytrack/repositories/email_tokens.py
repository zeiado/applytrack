import uuid
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from applytrack.models import EmailToken, EmailTokenPurpose


class EmailTokenRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, token: EmailToken) -> EmailToken:
        self.session.add(token)
        self.session.flush()
        return token

    def get_by_hash_for_update(self, token_hash: str) -> EmailToken | None:
        """Load and lock the row, so one link can't be used twice at the same moment."""
        return self.session.scalar(
            select(EmailToken).where(EmailToken.token_hash == token_hash).with_for_update()
        )

    def created_since(
        self, user_id: uuid.UUID, purpose: EmailTokenPurpose, since: datetime
    ) -> list[datetime]:
        """When this user's tokens of this purpose were created after ``since``, oldest first."""
        return list(
            self.session.scalars(
                select(EmailToken.created_at)
                .where(
                    EmailToken.user_id == user_id,
                    EmailToken.purpose == purpose,
                    EmailToken.created_at > since,
                )
                .order_by(EmailToken.created_at)
            )
        )

    def use_all(self, user_id: uuid.UUID, purpose: EmailTokenPurpose, now: datetime) -> None:
        """Mark every unused token of this purpose as used, so older links stop working."""
        self.session.execute(
            update(EmailToken)
            .where(
                EmailToken.user_id == user_id,
                EmailToken.purpose == purpose,
                EmailToken.used_at.is_(None),
            )
            .values(used_at=now)
        )

    def delete_expired(self, before: datetime) -> int:
        result = self.session.execute(delete(EmailToken).where(EmailToken.expires_at < before))
        return int(getattr(result, "rowcount", 0))
