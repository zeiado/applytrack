from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from applytrack.schemas.applications import ApplicationRead, StatusChangeRead
from applytrack.schemas.auth import UserRead
from applytrack.schemas.cvs import CVDetail
from applytrack.schemas.interviews import InterviewRead
from applytrack.schemas.profiles import ProfileRead


class ExportedApplication(ApplicationRead):
    history: list[StatusChangeRead]
    interviews: list[InterviewRead]


class AccountExport(BaseModel):
    """Everything ApplyTrack stores about the user (Egypt PDPL 151/2020 data access)."""

    exported_at: datetime
    user: UserRead
    profile: ProfileRead
    cvs: list[CVDetail]
    applications: list[ExportedApplication]


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str | None = Field(
        default=None, min_length=1, max_length=128, description="Your current password"
    )
    google_id_token: str | None = Field(
        default=None,
        min_length=1,
        max_length=4096,
        description="Instead of the password: a new ID token from signing in with the "
        "linked Google account",
    )

    @model_validator(mode="after")
    def _exactly_one_confirmation(self) -> Self:
        if (self.password is None) == (self.google_id_token is None):
            raise ValueError("Send either password or google_id_token")
        return self
