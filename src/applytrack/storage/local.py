"""Files in a local folder, for development and the end-to-end tests.

Its links point to this API (``/local-storage/...``, api/routes/local_storage.py) and
are signed like the real ones, so the web app uploads the same way as in production.
"""

import hashlib
import hmac
import time
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlencode

from applytrack.storage import StorageError, UploadLink, check_key

LOCAL_STORAGE_PATH = "/local-storage"


class LocalStorage:
    def __init__(
        self,
        directory: Path,
        *,
        public_url: str,
        secret: str,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.directory = directory
        self.public_url = public_url.rstrip("/")
        self._secret = hashlib.sha256(f"local-storage:{secret}".encode()).digest()
        self.clock = clock

    def path(self, key: str) -> Path:
        return self.directory / check_key(key)

    def signature(self, method: str, key: str, expires_at: int, details: dict[str, str]) -> str:
        signed = "\n".join(f"{name}={details[name]}" for name in sorted(details))
        message = f"{method}\n{key}\n{expires_at}\n{signed}".encode()
        return hmac.new(self._secret, message, hashlib.sha256).hexdigest()

    def verify(
        self, method: str, key: str, expires_at: int, details: dict[str, str], signature: str
    ) -> bool:
        expected = self.signature(method, key, expires_at, details)
        return hmac.compare_digest(expected, signature) and expires_at > self.clock()

    def _link(self, method: str, key: str, expires: timedelta, details: dict[str, str]) -> str:
        expires_at = int(self.clock() + expires.total_seconds())
        signature = self.signature(method, check_key(key), expires_at, details)
        query = urlencode({**details, "expires": expires_at, "signature": signature})
        return f"{self.public_url}{LOCAL_STORAGE_PATH}/{key}?{query}"

    def upload_link(
        self, key: str, *, content_type: str, size: int, expires: timedelta
    ) -> UploadLink:
        url = self._link("PUT", key, expires, {"type": content_type, "size": str(size)})
        return UploadLink(url, {"Content-Type": content_type})

    def download_link(self, key: str, *, filename: str, expires: timedelta) -> str:
        return self._link("GET", key, expires, {"filename": filename})

    def size(self, key: str) -> int | None:
        path = self.path(key)
        return path.stat().st_size if path.is_file() else None

    def read(self, key: str) -> bytes:
        try:
            return self.path(key).read_bytes()
        except OSError as exc:
            raise StorageError(str(exc)) from exc

    def write(self, key: str, data: bytes) -> None:
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete(self, key: str) -> None:
        self.path(key).unlink(missing_ok=True)
