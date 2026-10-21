from datetime import datetime

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.base import Base, TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("locale IN ('ar', 'en')", name="locale"),)

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    # Language for emails: "ar" or "en" (mail/templates.py).
    locale: Mapped[str] = mapped_column(String(2), default="en", server_default="en")
    # Set when the user opens the link in the verification email.
    email_verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None
