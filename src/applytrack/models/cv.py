import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from applytrack.models.application import enum_column
from applytrack.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from applytrack.models.enums import CVStatus


class CV(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A CV the user uploaded (#115). The file lives in object storage under
    ``storage_key`` (docs/adr/0011-object-storage-for-cvs.md); the text read from it is
    kept here for Sekka AI."""

    __tablename__ = "cvs"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    status: Mapped[CVStatus] = mapped_column(enum_column(CVStatus, "cv_status"))
    text: Mapped[str | None] = mapped_column(Text)
    # Why reading the file failed, as a code the web app translates.
    error: Mapped[str | None] = mapped_column(String(40))
    # While uploading: the CV this one replaces, deleted once the upload completes.
    replaces_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cvs.id", ondelete="SET NULL"))
