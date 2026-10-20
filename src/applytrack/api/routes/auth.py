from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from applytrack.api.deps import AppSettings, DbSession, Now
from applytrack.core.config import Settings
from applytrack.core.errors import ErrorResponse, TooManyRequestsError, UnauthorizedError
from applytrack.core.rate_limit import LoginRateLimiter
from applytrack.schemas.auth import RefreshRequest, RegisterRequest, TokenResponse, UserRead
from applytrack.services.auth import AuthService, normalize_email
from applytrack.services.tokens import TokenPair, TokenService

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(pair: TokenPair, settings: Settings) -> TokenResponse:
    return TokenResponse(
        access_token=pair.access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        refresh_token=pair.refresh_token,
        refresh_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


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
    now: Now,
) -> TokenResponse:
    """Exchange email and password for an access token and a refresh token.

    Uses the OAuth2 password form (`username` = email) so the Authorize button in /docs works.
    Repeated failures are rate limited per IP and email, and per IP.
    """
    limiter: LoginRateLimiter = request.app.state.login_limiter
    # The real client IP, also behind a proxy (APPLYTRACK_TRUSTED_PROXY_HOPS, core/client_ip.py).
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
    return _token_response(TokenService(db, settings).issue(user.id, now), settings)


@router.post("/refresh", responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}})
def refresh(body: RefreshRequest, db: DbSession, settings: AppSettings, now: Now) -> TokenResponse:
    """Exchange a refresh token for a new access token and refresh token.

    The refresh token you send stops working. Sending an already used token again
    signs the user out of every session, since it suggests the token was stolen.
    """
    return _token_response(TokenService(db, settings).refresh(body.refresh_token, now), settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: DbSession, settings: AppSettings, now: Now) -> Response:
    """Revoke a refresh token. Always succeeds, so it can't be used to test tokens."""
    TokenService(db, settings).logout(body.refresh_token, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
