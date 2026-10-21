import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, UTCDateTime, UUIDPrimaryKeyMixin, utcnow
from applytrack.models.enums import EmailTokenPurpose


class EmailToken(UUIDPrimaryKeyMixin, Base):
    """A one-time link sent by email: verify an address, or reset a password
    (docs/adr/0008-one-time-email-tokens.md).

    Only a SHA-256 hash of the token is stored. A token works once, until
    ``expires_at``. Rows stay after use, so the per-hour email limit can count them.
    """

    __tablename__ = "email_tokens"
    __table_args__ = (
        # Serves the per-hour limit and "invalidate this user's other tokens".
        Index("ix_email_tokens_user_id_purpose_created_at", "user_id", "purpose", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[EmailTokenPurpose] = mapped_column(
        enum_column(EmailTokenPurpose, "email_token_purpose")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
