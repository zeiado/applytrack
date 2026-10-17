import io
import json
import logging
import re
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.testclient import TestClient

from applytrack.core.config import Settings, resolved_log_format
from applytrack.core.logging import (
    JsonFormatter,
    RequestIdFilter,
    accept_request_id,
    configure_logging,
    request_id_var,
)

HEX32 = re.compile(r"[0-9a-f]{32}")


# --- Request ids ------------------------------------------------------------


def test_every_response_gets_a_request_id(client: TestClient) -> None:
    first = client.get("/health").headers["x-request-id"]
    second = client.get("/health").headers["x-request-id"]

    assert HEX32.fullmatch(first)
    assert first != second


def test_a_valid_incoming_id_is_reused(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-ID": "frontend-42.abc_DEF"})

    assert response.headers["x-request-id"] == "frontend-42.abc_DEF"


@pytest.mark.parametrize(
    "incoming",
    [
        "x" * 65,
        "has spaces",
        "line\nbreak",  # would let a client forge extra log lines
        "fake\r\n2026-01-01 ERROR admin logged in",
        "<script>",
        "",
    ],
    ids=["too-long", "spaces", "newline", "crlf-forgery", "html", "empty"],
)
def test_unsafe_incoming_ids_are_replaced(incoming: str) -> None:
    assert HEX32.fullmatch(accept_request_id(incoming))


def test_error_bodies_carry_the_request_id(client: TestClient) -> None:
    response = client.get("/nope", headers={"X-Request-ID": "trace-me"})

    assert response.status_code == 404
    assert response.json()["error"]["request_id"] == "trace-me"


def test_request_id_is_reset_after_the_request(client: TestClient) -> None:
    client.get("/health")

    assert request_id_var.get() == "-"


# --- Access log -------------------------------------------------------------


def test_access_log_line(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="applytrack.access")

    client.get("/health?email=secret@example.com", headers={"X-Request-ID": "req-1"})

    [record] = [r for r in caplog.records if r.name == "applytrack.access"]
    assert record.getMessage() == "GET /health 200"
    assert record.levelno == logging.INFO
    http = record.http  # type: ignore[attr-defined]
    assert http["method"] == "GET"
    assert http["path"] == "/health"  # query string left out on purpose
    assert http["status"] == 200
    assert http["duration_ms"] >= 0
    assert http["client"] == "testclient"
    ours = " ".join(
        f"{r.getMessage()} {r.__dict__}" for r in caplog.records if r.name.startswith("applytrack")
    )
    assert "secret@example.com" not in ours  # (the test client itself logs the full URL)


def test_log_records_inside_a_request_carry_its_id(
    app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    @app.get("/_test/log")
    def log_something() -> dict[str, str]:
        logging.getLogger("applytrack.test").warning("inside the request")
        return {}

    caplog.handler.addFilter(RequestIdFilter())
    with TestClient(app) as client:
        client.get("/_test/log", headers={"X-Request-ID": "abc-123"})

    [record] = [r for r in caplog.records if r.name == "applytrack.test"]
    assert record.request_id == "abc-123"  # type: ignore[attr-defined]


# --- Unhandled errors -------------------------------------------------------


@pytest.fixture
def crashing_app(app: FastAPI) -> FastAPI:
    @app.get("/_test/crash")
    def crash() -> None:
        raise RuntimeError("secret internals")

    @app.get("/_test/crash-mid-stream")
    def crash_mid_stream() -> StreamingResponse:
        def body() -> Iterator[str]:
            yield "partial,"
            raise RuntimeError("database went away")

        return StreamingResponse(body(), media_type="text/csv")

    return app


def test_unhandled_error_is_a_clean_500_with_request_id(
    crashing_app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    with TestClient(crashing_app, raise_server_exceptions=False) as client:
        response = client.get("/_test/crash", headers={"X-Request-ID": "boom-1"})

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "boom-1"
    assert response.json()["error"] == {
        "code": "internal_error",
        "message": "An unexpected error occurred",
        "request_id": "boom-1",
    }
    assert "secret internals" not in response.text
    access = [r for r in caplog.records if r.name == "applytrack.access"]
    assert access[-1].levelno == logging.ERROR
    assert access[-1].http["status"] == 500  # type: ignore[attr-defined]
    [error] = [r for r in caplog.records if r.name == "applytrack.errors"]
    assert error.exc_info is not None


def test_error_after_the_response_started_is_re_raised(
    crashing_app: FastAPI, caplog: pytest.LogCaptureFixture
) -> None:
    with (
        TestClient(crashing_app) as client,
        pytest.raises(RuntimeError, match="database went away"),
    ):
        client.get("/_test/crash-mid-stream")

    assert "Unhandled error on GET /_test/crash-mid-stream" in caplog.text


# --- Formatters and setup ---------------------------------------------------


def _record(**extra: object) -> logging.LogRecord:
    record = logging.LogRecord(
        "applytrack.x", logging.WARNING, __file__, 1, "hi %s", ("there",), None
    )
    record.__dict__.update(extra)
    return record


def test_json_formatter() -> None:
    entry = json.loads(JsonFormatter().format(_record(request_id="r1", http={"status": 200})))

    assert entry["level"] == "WARNING"
    assert entry["logger"] == "applytrack.x"
    assert entry["message"] == "hi there"
    assert entry["request_id"] == "r1"
    assert entry["http"] == {"status": 200}
    assert entry["time"].endswith("+00:00")
    assert "exception" not in entry


def test_json_formatter_includes_exceptions_and_unicode() -> None:
    try:
        raise ValueError("bad")
    except ValueError:
        import sys

        record = logging.LogRecord("x", logging.ERROR, __file__, 1, "شركة", None, sys.exc_info())

    entry = json.loads(line := JsonFormatter().format(record))

    assert "ValueError: bad" in entry["exception"]
    assert entry["request_id"] == "-"
    assert "شركة" in line  # not escaped to \\u sequences


@pytest.mark.parametrize(
    ("environment", "log_format", "expected"),
    [
        ("production", "auto", "json"),
        ("local", "auto", "text"),
        ("test", "auto", "text"),
        ("local", "json", "json"),
        ("production", "text", "text"),
    ],
)
def test_resolved_log_format(environment: Any, log_format: Any, expected: str) -> None:
    settings = Settings.model_construct(environment=environment, log_format=log_format)

    assert resolved_log_format(settings) == expected


@pytest.mark.parametrize("log_format", ["json", "text"])
def test_configure_logging(log_format: str, monkeypatch: pytest.MonkeyPatch) -> None:
    root = logging.getLogger()
    before = list(root.handlers)
    level = root.level
    try:
        handler = configure_logging(level="debug", log_format=log_format)  # type: ignore[arg-type]
        configure_logging(level="debug", log_format=log_format)  # type: ignore[arg-type]

        ours = [h for h in root.handlers if getattr(h, "_applytrack", False)]
        assert len(ours) == 1  # calling twice doesn't duplicate output
        assert root.level == logging.DEBUG
        assert logging.getLogger("uvicorn.access").disabled

        stream = io.StringIO()
        monkeypatch.setattr(ours[0], "stream", stream)
        logging.getLogger("applytrack.cfg").info("hello")
        output = stream.getvalue()
        if log_format == "json":
            assert json.loads(output)["message"] == "hello"
        else:
            assert "INFO    [-] applytrack.cfg: hello" in output
        assert handler is not None
    finally:
        for h in list(root.handlers):
            if h not in before:
                root.removeHandler(h)
        root.setLevel(level)
        logging.getLogger("uvicorn.access").disabled = False


def test_production_entry_point_configures_logging(monkeypatch: pytest.MonkeyPatch) -> None:
    from applytrack import main

    calls: list[dict[str, str]] = []
    monkeypatch.setattr(main, "configure_logging", lambda **kw: calls.append(kw))

    app = main.create_production_app()

    assert isinstance(app, FastAPI)
    assert calls == [{"level": "INFO", "log_format": "text"}]
