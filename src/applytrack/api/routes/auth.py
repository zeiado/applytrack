from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from applytrack.api.deps import AppSettings, DbSession
from applytrack.core.errors import ErrorResponse, TooManyRequestsError, UnauthorizedError
from applytrack.core.rate_limit import LoginRateLimiter
from applytrack.core.security import create_access_token
from applytrack.schemas.auth import RegisterRequest, TokenResponse, UserRead
from applytrack.services.auth import AuthService, normalize_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: {"model": ErrorResponse}},
)
def register(body: RegisterRequest, db: DbSession) -> UserRead:
    """Create an account."""
    user = AuthService(db).register(body.email, body.password)
    return UserRead.model_validate(user)


@router.post(
    "/login",
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "model": ErrorResponse,
            "description": "Too many failed logins; see the Retry-After header",
        },
    },
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    request: Request,
    db: DbSession,
    settings: AppSettings,
) -> TokenResponse:
    """Exchange email and password for an access token.

    Uses the OAuth2 password form (`username` = email) so the Authorize button in /docs works.
    Repeated failures are rate limited per IP and email, and per IP.
    """
    limiter: LoginRateLimiter = request.app.state.login_limiter
    # Behind a proxy, run uvicorn with --proxy-headers so this is the real client IP.
    ip = request.client.host if request.client else "unknown"
    email = normalize_email(form.username)

    # Checked before the password, so blocked attempts don't cost an Argon2 hash.
    wait = limiter.retry_after(ip, email)
    if wait is not None:
        raise TooManyRequestsError(
            f"Too many failed login attempts. Try again in {wait} seconds.",
            retry_after=wait,
            code="too_many_login_attempts",
        )

    try:
        user = AuthService(db).authenticate(email, form.password)
    except UnauthorizedError:
        limiter.record_failure(ip, email)
        raise
    limiter.record_success(ip, email)
    return TokenResponse(
        access_token=create_access_token(user.id, settings),
        expires_in=settings.access_token_expire_minutes * 60,
    )
