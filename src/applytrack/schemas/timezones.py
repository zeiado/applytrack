from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, Field


def _valid_timezone(name: str) -> str:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"Unknown timezone {name!r}; use an IANA name like Africa/Cairo") from exc
    return name


Timezone = Annotated[str, Field(max_length=64), AfterValidator(_valid_timezone)]
