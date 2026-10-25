from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
)

from applytrack.models import ExperienceLevel, ProfileVisibility


def _blank_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


def _unique(tags: list[str]) -> list[str]:
    """Drops repeats, ignoring case, and keeps the user's order."""
    seen: set[str] = set()
    kept = []
    for tag in tags:
        if tag.casefold() not in seen:
            seen.add(tag.casefold())
            kept.append(tag)
    return kept


Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Skills = Annotated[list[Tag], Field(max_length=30), AfterValidator(_unique)]
Languages = Annotated[list[Tag], Field(max_length=10), AfterValidator(_unique)]

# Optional free text: trimmed, and an empty string clears the field.
_Blank = BeforeValidator(_blank_to_none)


def _limit(max_length: int) -> StringConstraints:
    return StringConstraints(strip_whitespace=True, max_length=max_length)


DisplayName = Annotated[Annotated[str, _limit(100)] | None, _Blank]
Headline = Annotated[Annotated[str, _limit(160)] | None, _Blank]
City = Annotated[Annotated[str, _limit(100)] | None, _Blank]
Education = Annotated[Annotated[str, _limit(300)] | None, _Blank]


class ProfileRead(BaseModel):
    """Your profile. Empty until you save it for the first time."""

    model_config = ConfigDict(from_attributes=True)

    display_name: str | None = None
    headline: str | None = Field(
        default=None, description='e.g. "Final-year computer science student"'
    )
    city: str | None = None
    education: str | None = Field(
        default=None, description="Degree, school and year, in your words"
    )
    experience_level: ExperienceLevel | None = None
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    visibility: ProfileVisibility = Field(
        default=ProfileVisibility.PRIVATE,
        description="private: only you. recruiters: verified employers can find it (coming later)",
    )
    updated_at: datetime | None = Field(default=None, description="Null until the first save")


class ProfileUpdate(BaseModel):
    """Fields to change. Leave a field out to keep it; send null or "" to clear a text field."""

    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName = None
    headline: Headline = None
    city: City = None
    education: Education = None
    experience_level: ExperienceLevel | None = None
    skills: Skills | None = Field(default=None, description="Up to 30, each up to 50 characters")
    languages: Languages | None = Field(default=None, description="Up to 10")
    visibility: ProfileVisibility | None = None
