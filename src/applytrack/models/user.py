from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, String, true
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.base import Base, TimestampMixin, UTCDateTime, UUIDPrimaryKeyMixin

# Most users are in Egypt; anyone else sets theirs with PATCH /users/me.
DEFAULT_TIMEZONE = "Africa/Cairo"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("locale IN ('ar', 'en')", name="locale"),)

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # None for accounts created with Google that haven't set a password.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # Google's ID for the linked Google account ("sub" in its ID tokens).
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    # Language for emails: "ar" or "en" (mail/templates.py).
    locale: Mapped[str] = mapped_column(String(2), default="en", server_default="en")
    # Set when the user opens the link in the verification email.
    email_verified_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Set by a password reset. Access tokens issued before it are refused.
    password_changed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # IANA name. Decides when "the morning" is for reminder emails.
    timezone: Mapped[str] = mapped_column(
        String(64), default=DEFAULT_TIMEZONE, server_default=DEFAULT_TIMEZONE
    )
    reminder_emails: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    # The user's local date when reminders were last checked (an email was sent, or
    # nothing was due), so there is never more than one check a day.
    reminders_checked_on: Mapped[date | None] = mapped_column(Date)

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def sign_in_methods(self) -> list[str]:
        methods = []
        if self.password_hash is not None:
            methods.append("password")
        if self.google_subject is not None:
            methods.append("google")
        return methods
