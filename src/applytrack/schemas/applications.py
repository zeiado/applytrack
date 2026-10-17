import uuid
from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    TypeAdapter,
    model_validator,
)

from applytrack.models import ApplicationSource, ApplicationStatus
from applytrack.schemas.pagination import MAX_PAGE_SIZE

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
_http_url = TypeAdapter(HttpUrl)


def _validate_http_url(value: str) -> str:
    return str(_http_url.validate_python(value))


# Validated as an http(s) URL, kept as a plain string.
JobUrl = Annotated[
    str,
    Field(max_length=2048, json_schema_extra={"format": "uri"}),
    AfterValidator(_validate_http_url),
]
Salary = Annotated[int, Field(ge=0, le=100_000_000)]
Notes = Annotated[str, Field(max_length=10_000)]


def _check_salary_range(salary_min: int | None, salary_max: int | None) -> None:
    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise ValueError("salary_min must be less than or equal to salary_max")


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: Name
    role_title: Name
    job_url: JobUrl | None = None
    source: ApplicationSource = ApplicationSource.OTHER
    # New applications start in an early stage; later stages go through the status endpoint.
    status: Literal[ApplicationStatus.WISHLIST, ApplicationStatus.APPLIED] = (
        ApplicationStatus.APPLIED
    )
    salary_min: Salary | None = None
    salary_max: Salary | None = None
    applied_on: date | None = None
    follow_up_on: date | None = None
    notes: Notes | None = None

    @model_validator(mode="after")
    def _salary_range(self) -> Self:
        _check_salary_range(self.salary_min, self.salary_max)
        return self


class ApplicationUpdate(BaseModel):
    """Partial update: only fields sent are changed; send null to clear an optional field.

    `status` is not here on purpose: status changes are validated by their own endpoint.
    """

    model_config = ConfigDict(extra="forbid")

    company: Name | None = None
    role_title: Name | None = None
    job_url: JobUrl | None = None
    source: ApplicationSource | None = None
    salary_min: Salary | None = None
    salary_max: Salary | None = None
    applied_on: date | None = None
    follow_up_on: date | None = None
    notes: Notes | None = None

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> Self:
        for name in ("company", "role_title", "source"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ApplicationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company: str
    role_title: str
    job_url: str | None
    source: ApplicationSource
    status: ApplicationStatus
    salary_min: int | None
    salary_max: int | None
    applied_on: date | None
    follow_up_on: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


SortField = Literal["created_at", "-created_at", "applied_on", "-applied_on", "company", "-company"]


class ApplicationListParams(BaseModel):
    """Query parameters for listing applications. Unknown parameters are rejected."""

    model_config = ConfigDict(extra="forbid")

    status: list[ApplicationStatus] | None = Field(
        default=None, description="Repeat to match any of several: ?status=applied&status=screening"
    )
    source: list[ApplicationSource] | None = None
    company: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = (
        Field(default=None, description="Case-insensitive partial match")
    )
    sort: SortField = Field(default="-created_at", description="Prefix with - for descending")
    limit: int = Field(default=20, ge=1, le=MAX_PAGE_SIZE)
    offset: int = Field(default=0, ge=0)
