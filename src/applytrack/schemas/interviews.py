import uuid
from datetime import UTC, datetime
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from applytrack.models import InterviewKind

Interviewer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Duration = Annotated[int, Field(gt=0, le=1440, description="Minutes")]
Notes = Annotated[str, Field(max_length=10_000)]
# Must include a timezone (2026-10-20T14:00:00+03:00) so the time isn't ambiguous.
# Converted to UTC right away, so every response shows the same format.
UtcDatetime = Annotated[AwareDatetime, AfterValidator(lambda dt: dt.astimezone(UTC))]


class InterviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_at: UtcDatetime
    kind: InterviewKind = InterviewKind.OTHER
    duration_minutes: Duration | None = None
    interviewer: Interviewer | None = None
    notes: Notes | None = None


class InterviewUpdate(BaseModel):
    """Partial update: only fields sent are changed; send null to clear an optional field."""

    model_config = ConfigDict(extra="forbid")

    scheduled_at: UtcDatetime | None = None
    kind: InterviewKind | None = None
    duration_minutes: Duration | None = None
    interviewer: Interviewer | None = None
    notes: Notes | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> Self:
        for name in ("scheduled_at", "kind"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class InterviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    scheduled_at: datetime
    kind: InterviewKind
    duration_minutes: int | None
    interviewer: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
