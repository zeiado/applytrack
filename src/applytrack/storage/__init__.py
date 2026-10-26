"""Object storage for uploaded files (docs/adr/0011-object-storage-for-cvs.md).

Browsers upload and download files straight from storage with short-lived signed
links, so files never pass through the API. The API only checks them and reads them
on the job queue.
"""

import re
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Protocol
from urllib.parse import quote

from applytrack.core.config import Settings


class StorageError(Exception):
    """Storage couldn't be reached or refused a request. Usually worth retrying."""


@dataclass(frozen=True)
class UploadLink:
    url: str
    # The upload must send exactly these headers, or storage rejects it.
    headers: dict[str, str]


class ObjectStorage(Protocol):
    def upload_link(
        self, key: str, *, content_type: str, size: int, expires: timedelta
    ) -> UploadLink:
        """A link that accepts one PUT of exactly ``size`` bytes of ``content_type``."""
        ...

    def download_link(self, key: str, *, filename: str, expires: timedelta) -> str:
        """A link that downloads the file under ``filename``."""
        ...

    def size(self, key: str) -> int | None:
        """The stored file's size in bytes, or None if there's no such file."""
        ...

    def read(self, key: str) -> bytes: ...

    def delete(self, key: str) -> None:
        """Delete the file. Deleting a missing file is fine."""
        ...


_KEY = re.compile(r"[a-z0-9]+(/[a-z0-9]+)*")


def check_key(key: str) -> str:
    """Keys are made by the API, never by users; this keeps them to safe characters."""
    if len(key) > 100 or not _KEY.fullmatch(key):
        raise ValueError(f"Invalid storage key: {key!r}")
    return key


def content_disposition(filename: str) -> str:
    """``attachment`` with the original name, which may be Arabic (RFC 6266)."""
    fallback = re.sub(r"[^A-Za-z0-9._ -]", "_", filename) or "download"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"


def build_storage(settings: Settings) -> ObjectStorage | None:
    """The configured storage, or None when uploads are off."""
    if settings.storage_endpoint:
        from applytrack.storage.s3 import S3Storage

        assert settings.storage_bucket and settings.storage_access_key_id  # noqa: S101 (validated)
        assert settings.storage_secret_access_key  # noqa: S101 (validated in Settings)
        return S3Storage.connect(
            endpoint=settings.storage_endpoint,
            bucket=settings.storage_bucket,
            access_key_id=settings.storage_access_key_id,
            secret_access_key=settings.storage_secret_access_key.get_secret_value(),
            region=settings.storage_region,
        )
    if settings.storage_local_dir:
        from applytrack.storage.local import LocalStorage

        return LocalStorage(
            Path(settings.storage_local_dir),
            public_url=settings.storage_local_url,
            secret=settings.jwt_secret_key.get_secret_value(),
        )
    return None
