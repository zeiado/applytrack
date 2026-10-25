import uuid

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, TimestampMixin
from applytrack.models.enums import ExperienceLevel, ProfileVisibility


class Profile(TimestampMixin, Base):
    """What the user tells Sekka about themselves (1:1 with users, created on first save).
    Sekka AI uses it to tailor answers; recruiters see it only when visibility allows."""

    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str | None] = mapped_column(String(100))
    headline: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str | None] = mapped_column(String(100))
    education: Mapped[str | None] = mapped_column(String(300))
    experience_level: Mapped[ExperienceLevel | None] = mapped_column(
        enum_column(ExperienceLevel, "experience_level")
    )
    # Short free-text tags, in the user's order.
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    languages: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[ProfileVisibility] = mapped_column(
        enum_column(ProfileVisibility, "profile_visibility"),
        default=ProfileVisibility.PRIVATE,
        server_default=ProfileVisibility.PRIVATE.value,
    )
