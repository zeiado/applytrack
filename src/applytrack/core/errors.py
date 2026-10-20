"""One error shape for the whole API.

``{"error": {"code": "...", "message": "...", "details": [...]}}``
"""

from collections.abc import Mapping
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from applytrack.core.logging import request_id_var


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None
    request_id: str | None = Field(
        default=None, description="Quote this when reporting a problem; it's in the server logs"
    )


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AppError(Exception):
    """An error the API returns on purpose.

    Services raise these instead of HTTPException, so business code stays free of HTTP details.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: list[dict[str, Any]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details
        self.headers = {**self.default_headers(), **(headers or {})}
        if code is not None:
            self.code = code

    def default_headers(self) -> dict[str, str]:
        return {}


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class ValidationFailedError(AppError):
    """Input that is well-formed but breaks a business rule (e.g. salary_min > salary_max)."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "validation_error"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"

    def default_headers(self) -> dict[str, str]:
        return {"WWW-Authenticate": "Bearer"}


class ForbiddenError(AppError):
    """Logged in, but not allowed (e.g. the password confirming a deletion was wrong)."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


class TooManyRequestsError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "too_many_requests"

    def __init__(self, message: str, *, retry_after: int, code: str | None = None) -> None:
        super().__init__(message, code=code, headers={"Retry-After": str(retry_after)})
        self.retry_after = retry_after


def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    request_id = request_id_var.get()
    body = ErrorResponse(
        error=ErrorDetail(
            code=code,
            message=message,
            details=details,
            request_id=request_id if request_id != "-" else None,
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(exclude_none=True),
        headers=headers,
    )


def _code_for_status(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase.lower().replace(" ", "_").replace("-", "_")
    except ValueError:
        return "error"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(
            exc.status_code, exc.code, exc.message, details=exc.details, headers=exc.headers or None
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error_response(
            exc.status_code,
            _code_for_status(exc.status_code),
            str(exc.detail),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(part) for part in err["loc"]),
                "message": err["msg"],
                "type": err["type"],
            }
            for err in jsonable_encoder(exc.errors())
        ]
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            "Request validation failed",
            details=details,
        )


def internal_error_response() -> JSONResponse:
    """The generic 500 body. Used by the request middleware for unhandled exceptions."""
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", "An unexpected error occurred"
    )
