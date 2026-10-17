from collections.abc import Sequence
from dataclasses import dataclass

from applytrack.models import ApplicationSource, ApplicationStatus


@dataclass(frozen=True)
class ApplicationFilters:
    statuses: Sequence[ApplicationStatus] | None = None
    sources: Sequence[ApplicationSource] | None = None
    company: str | None = None
