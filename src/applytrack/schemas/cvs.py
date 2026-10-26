import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from applytrack.models import CVStatus

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MAX_CV_BYTES = 5 * 1024 * 1024

CVContentType = Literal[
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]


def _plain_filename(name: str) -> str:
    """Just the name: no folders, no control characters."""
    name = re.split(r"[\\/]", name)[-1]
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
    if not name:
        raise ValueError("Enter the file's name")
    return name


Filename = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=255),
    AfterValidator(_plain_filename),
]


class CVUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: Filename
    content_type: CVContentType = Field(description="PDF or Word (.docx)")
    size_bytes: int = Field(gt=0, le=MAX_CV_BYTES, description="Up to 5 MB")
    replaces: uuid.UUID | None = Field(
        default=None,
        description="A CV of yours to replace: it's deleted once this upload completes, "
        "and doesn't count toward the limit meanwhile",
    )


class CVRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    status: CVStatus
    error: str | None = Field(
        description="When status is failed: `wrong_type`, `encrypted`, `unreadable`, "
        "`no_text` (a scanned image) or `storage_error`"
    )
    created_at: datetime
    updated_at: datetime


class CVDetail(CVRead):
    text: str | None = Field(description="The text read from the file, once it's ready")


class UploadInstructions(BaseModel):
    url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str] = Field(description="Send exactly these headers with the file")
    expires_at: datetime


class CVUploadStart(BaseModel):
    cv: CVRead
    upload: UploadInstructions


class CVDownload(BaseModel):
    url: str
    expires_at: datetime
