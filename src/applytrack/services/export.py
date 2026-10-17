"""CSV export. Pure functions: applications in, CSV text chunks out."""

import csv
import io
from collections.abc import Iterable, Iterator
from typing import Any

from applytrack.models import Application

COLUMNS = (
    "id",
    "company",
    "role_title",
    "status",
    "source",
    "applied_on",
    "follow_up_on",
    "salary_min",
    "salary_max",
    "job_url",
    "notes",
    "created_at",
    "updated_at",
)

UTF8_BOM = "﻿"

# A cell starting with one of these is run as a formula by Excel, LibreOffice and
# Google Sheets ("CSV injection"). OWASP's advice: prefix the cell with a quote.
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return "'" + value if value.startswith(_FORMULA_PREFIXES) else value
    if hasattr(value, "isoformat"):
        return str(value.isoformat())
    return str(value)  # numbers, UUIDs, enums (StrEnum → its value)


def _line(cells: Iterable[Any]) -> str:
    buffer = io.StringIO()
    csv.writer(buffer, lineterminator="\r\n").writerow(cells)
    return buffer.getvalue()


def to_csv(applications: Iterable[Application], *, bom: bool = True) -> Iterator[str]:
    """Yield the header line, then one line per application, without building the whole file."""
    yield (UTF8_BOM if bom else "") + _line(COLUMNS)
    for application in applications:
        yield _line(safe_cell(getattr(application, column)) for column in COLUMNS)
