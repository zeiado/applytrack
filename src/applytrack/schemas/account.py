from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from applytrack.schemas.applications import ApplicationRead, StatusChangeRead
from applytrack.schemas.auth import UserRead
from applytrack.schemas.interviews import InterviewRead


class ExportedApplication(ApplicationRead):
    history: list[StatusChangeRead]
    interviews: list[InterviewRead]


class AccountExport(BaseModel):
    """Everything ApplyTrack stores about the user (Egypt PDPL 151/2020 data access)."""

    exported_at: datetime
    user: UserRead
    applications: list[ExportedApplication]


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1, max_length=128, description="Your current password")
