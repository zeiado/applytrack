"""Object storage: the R2/S3 backend, settings, and reading awkward files."""

import zipfile
from datetime import timedelta
from io import BytesIO
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber
from pydantic import ValidationError
from pypdf import PdfWriter

from applytrack.core.config import Settings
from applytrack.schemas.cvs import DOCX, PDF
from applytrack.services import cv_text
from applytrack.services.cv_text import UnreadableCV, extract_text
from applytrack.storage import StorageError, build_storage, content_disposition
from applytrack.storage.local import LocalStorage
from applytrack.storage.s3 import S3Storage

R2 = {
    "storage_endpoint": "https://account.r2.cloudflarestorage.com",
    "storage_bucket": "sekka-cvs",
    "storage_access_key_id": "key-id",
    "storage_secret_access_key": "secret",
}


@pytest.fixture
def s3() -> S3Storage:
    storage = build_storage(Settings(environment="test", **R2))  # type: ignore[arg-type]
    assert isinstance(storage, S3Storage)
    return storage


def test_settings_pick_the_backend() -> None:
    assert build_storage(Settings(environment="test")) is None
    local = build_storage(Settings(environment="test", storage_local_dir="files"))
    assert isinstance(local, LocalStorage)


@pytest.mark.parametrize(
    ("values", "message"),
    [
        ({"storage_endpoint": R2["storage_endpoint"]}, "half configured"),
        ({**R2, "storage_endpoint": "http://insecure"}, "must start with https://"),
        ({"environment": "production", "storage_local_dir": "x"}, "development only"),
    ],
)
def test_storage_settings_are_checked(values: dict[str, Any], message: str) -> None:
    values = {"environment": "test", **values}
    if values["environment"] == "production":
        values["jwt_secret_key"] = "x" * 40
    with pytest.raises(ValidationError, match=message):
        Settings(**values)


def test_upload_links_sign_the_type_and_size(s3: S3Storage) -> None:
    link = s3.upload_link("cvs/abc", content_type=PDF, size=1234, expires=timedelta(minutes=10))
    url = urlsplit(link.url)
    assert url.netloc == "account.r2.cloudflarestorage.com"
    assert url.path == "/sekka-cvs/cvs/abc"
    query = parse_qs(url.query)
    assert query["X-Amz-SignedHeaders"] == ["content-length;content-type;host"]
    assert query["X-Amz-Expires"] == ["600"]
    assert link.headers == {"Content-Type": PDF}


def test_download_links_name_the_file(s3: S3Storage) -> None:
    url = s3.download_link("cvs/abc", filename="my cv.pdf", expires=timedelta(minutes=5))
    query = parse_qs(urlsplit(url).query)
    assert query["response-content-disposition"] == [content_disposition("my cv.pdf")]


def test_size_read_and_delete(s3: S3Storage) -> None:
    with Stubber(s3.client) as stub:
        stub.add_response(
            "head_object", {"ContentLength": 42}, {"Bucket": "sekka-cvs", "Key": "cvs/a"}
        )
        stub.add_client_error("head_object", "404", http_status_code=404)
        assert s3.size("cvs/a") == 42
        assert s3.size("cvs/missing") is None

    with Stubber(s3.client) as stub:
        stub.add_client_error("head_object", "InternalError", http_status_code=500)
        with pytest.raises(StorageError):
            s3.size("cvs/a")

    with Stubber(s3.client) as stub:
        data = b"%PDF-1.4"
        stub.add_response(
            "get_object",
            {"Body": StreamingBody(BytesIO(data), len(data))},
            {"Bucket": "sekka-cvs", "Key": "cvs/a"},
        )
        stub.add_client_error("get_object", "NoSuchKey", http_status_code=404)
        assert s3.read("cvs/a") == data
        with pytest.raises(StorageError):
            s3.read("cvs/a")

    with Stubber(s3.client) as stub:
        stub.add_response("delete_object", {}, {"Bucket": "sekka-cvs", "Key": "cvs/a"})
        stub.add_client_error("delete_object", "AccessDenied", http_status_code=403)
        s3.delete("cvs/a")
        with pytest.raises(StorageError):
            s3.delete("cvs/a")


def test_keys_are_checked(s3: S3Storage) -> None:
    for key in ["../x", "cvs/", "CVS/a", "a" * 101, "cvs/a.pdf"]:
        with pytest.raises(ValueError, match="Invalid storage key"):
            s3.upload_link(key, content_type=PDF, size=1, expires=timedelta(minutes=1))


# --- reading awkward files ---


def _zip(files: dict[str, bytes]) -> bytes:
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return out.getvalue()


def test_a_password_protected_pdf_is_refused() -> None:
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    writer.encrypt("secret")
    out = BytesIO()
    writer.write(out)
    with pytest.raises(UnreadableCV) as error:
        extract_text(out.getvalue(), PDF)
    assert error.value.code == "encrypted"


def test_a_zip_that_isnt_a_word_file_is_refused() -> None:
    with pytest.raises(UnreadableCV) as error:
        extract_text(_zip({"hello.txt": b"hi"}), DOCX)
    assert error.value.code == "wrong_type"


def test_a_word_file_that_unpacks_too_big_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cv_text, "MAX_UNPACKED_BYTES", 1000)
    with pytest.raises(UnreadableCV) as error:
        extract_text(_zip({"word/document.xml": b"0" * 5000}), DOCX)
    assert error.value.code == "unreadable"


def test_a_broken_word_file_is_unreadable() -> None:
    with pytest.raises(UnreadableCV) as error:
        extract_text(_zip({"word/document.xml": b"<not xml"}), DOCX)
    assert error.value.code == "unreadable"


def test_text_is_tidied() -> None:
    nbsp = chr(0xA0)
    messy = f"  Ada{nbsp}{nbsp}Lovelace \t\n\n\n\nAnalyst{chr(0)}  "
    assert cv_text.tidy(messy) == "Ada Lovelace\n\nAnalyst"


def test_content_disposition_falls_back_for_old_browsers() -> None:
    assert content_disposition('a"b.pdf') == (
        "attachment; filename=\"a_b.pdf\"; filename*=UTF-8''a%22b.pdf"
    )
