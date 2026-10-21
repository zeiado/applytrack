import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.base import Base, UTCDateTime, UUIDPrimaryKeyMixin, utcnow


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    """One issued refresh token (see docs/adr/0006-rotating-refresh-tokens.md).

    Only a SHA-256 hash of the token is stored. Tokens from one login share a
    ``family_id``: each refresh revokes the used token and issues the next one
    in the same family.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Set when a refresh replaced this token (as opposed to logout or revoke-all).
    rotated_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
