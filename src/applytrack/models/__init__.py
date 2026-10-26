"""ORM models. Import every model module here so Alembic autogenerate can see it."""

from applytrack.models.application import Application
from applytrack.models.base import Base
from applytrack.models.cv import CV
from applytrack.models.email_token import EmailToken
from applytrack.models.enums import (
    ApplicationSource,
    ApplicationStatus,
    CVStatus,
    EmailTokenPurpose,
    ExperienceLevel,
    InterviewKind,
    JobStatus,
    ProfileVisibility,
)
from applytrack.models.interview import Interview
from applytrack.models.job import Job
from applytrack.models.profile import Profile
from applytrack.models.refresh_token import RefreshToken
from applytrack.models.status_change import StatusChange
from applytrack.models.user import User

__all__ = [
    "CV",
    "Application",
    "ApplicationSource",
    "ApplicationStatus",
    "Base",
    "CVStatus",
    "EmailToken",
    "EmailTokenPurpose",
    "ExperienceLevel",
    "Interview",
    "InterviewKind",
    "Job",
    "JobStatus",
    "Profile",
    "ProfileVisibility",
    "RefreshToken",
    "StatusChange",
    "User",
]
