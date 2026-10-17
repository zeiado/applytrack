from collections.abc import Iterator

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from applytrack.core.errors import ConflictError, NotFoundError, UnauthorizedError
from tests.conftest import error_without_request_id


class Payload(BaseModel):
    name: str
    count: int


@pytest.fixture
def error_client(app: FastAPI) -> Iterator[TestClient]:
    """The real app plus a few routes that fail on purpose."""

    @app.get("/_test/not-found")
    def not_found() -> None:
        raise NotFoundError("Application not found")

    @app.get("/_test/conflict")
    def conflict() -> None:
        raise ConflictError("Cannot move from rejected to applied", code="invalid_transition")

    @app.get("/_test/unauthorized")
    def unauthorized() -> None:
        raise UnauthorizedError("Invalid token")

    @app.get("/_test/http-exception")
    def http_exception() -> None:
        raise HTTPException(status_code=418, detail="I'm a teapot")

    @app.get("/_test/unknown-status")
    def unknown_status() -> None:
        raise HTTPException(status_code=599, detail="Custom")

    @app.post("/_test/validate")
    def validate(payload: Payload) -> Payload:
        return payload

    @app.get("/_test/crash")
    def crash() -> None:
        raise RuntimeError("database password is hunter2")

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_app_error_uses_standard_shape(error_client: TestClient) -> None:
    response = error_client.get("/_test/not-found")

    assert response.status_code == 404
    assert error_without_request_id(response) == {
        "error": {"code": "not_found", "message": "Application not found"}
    }


def test_app_error_can_override_code(error_client: TestClient) -> None:
    response = error_client.get("/_test/conflict")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_transition"


def test_unauthorized_sets_www_authenticate_header(error_client: TestClient) -> None:
    response = error_client.get("/_test/unauthorized")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(
    ("method", "path", "status_code", "code"),
    [
        ("GET", "/does-not-exist", 404, "not_found"),
        ("DELETE", "/health", 405, "method_not_allowed"),
        ("GET", "/_test/http-exception", 418, "i'm_a_teapot"),
        ("GET", "/_test/unknown-status", 599, "error"),
    ],
)
def test_framework_http_errors_use_standard_shape(
    error_client: TestClient, method: str, path: str, status_code: int, code: str
) -> None:
    response = error_client.request(method, path)

    assert response.status_code == status_code
    assert response.json()["error"]["code"] == code


def test_validation_errors_list_each_field(error_client: TestClient) -> None:
    response = error_client.post("/_test/validate", json={"count": "many"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    fields = {d["field"] for d in error["details"]}
    assert fields == {"body.name", "body.count"}


def test_unexpected_errors_hide_internals(
    error_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    response = error_client.get("/_test/crash")

    assert response.status_code == 500
    assert error_without_request_id(response) == {
        "error": {"code": "internal_error", "message": "An unexpected error occurred"}
    }
    assert "hunter2" not in response.text
    assert "Unhandled error on GET /_test/crash" in caplog.text
