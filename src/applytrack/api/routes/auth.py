from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from applytrack.api.deps import AppSettings, CurrentUser, DbSession, Now
from applytrack.core.config import Settings
from applytrack.core.errors import ErrorResponse, TooManyRequestsError, UnauthorizedError
from applytrack.core.rate_limit import LoginRateLimiter, RateLimiter
from applytrack.schemas.auth import (
    EmailTokenRequest,
    ForgotPasswordRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserRead,
)
from applytrack.services.auth import AuthService, normalize_email
from applytrack.services.password_reset import PasswordResetService
from applytrack.services.tokens import TokenPair, TokenService
from applytrack.services.verification import EmailVerificationService

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
def register(body: RegisterRequest, db: DbSession, settings: AppSettings, now: Now) -> UserRead:
    """Create an account, and email a link to verify the address."""
    verification = EmailVerificationService(db, settings)
    user = AuthService(db).register(
        body.email,
        body.password,
        locale=body.locale,
        on_created=lambda new_user: verification.queue_email(new_user, now),
    )
    return UserRead.model_validate(user)


@router.post(
    "/verify-email",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "`invalid_verification_token` (unknown or already used) or "
            "`verification_token_expired`",
        }
    },
)
def verify_email(
    body: EmailTokenRequest, db: DbSession, settings: AppSettings, now: Now
) -> Response:
    """Confirm an email address with the token from the verification email.

    No login needed: the link may be opened on another device. Each link works once,
    and using one also cancels the user's older verification links.
    """
    EmailVerificationService(db, settings).verify(body.token, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/verify-email/resend",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_409_CONFLICT: {"model": ErrorResponse, "description": "Already verified"},
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "model": ErrorResponse,
            "description": "Too many verification emails this hour; see Retry-After",
        },
    },
)
def resend_verification_email(
    user: CurrentUser, db: DbSession, settings: AppSettings, now: Now
) -> Response:
    """Send a new verification link to the logged-in user (a few per hour at most)."""
    EmailVerificationService(db, settings).resend(user, now)
    return Response(status_code=status.HTTP_202_ACCEPTED)


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


@router.post(
    "/forgot-password",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "model": ErrorResponse,
            "description": "Too many requests from this IP address; see Retry-After",
        }
    },
)
def forgot_password(
    body: ForgotPasswordRequest, request: Request, db: DbSession, settings: AppSettings, now: Now
) -> Response:
    """Email a password reset link, valid for 30 minutes.

    Always answers `202`, whether or not the email has an account, so this can't be
    used to find accounts. Each account gets a few reset emails per hour at most.
    """
    limiter: RateLimiter = request.app.state.forgot_password_limiter
    ip = request.client.host if request.client else "unknown"
    wait = limiter.retry_after(ip)
    if wait is not None:
        raise TooManyRequestsError(
            f"Too many password reset requests. Try again in {wait} seconds.",
            retry_after=wait,
            code="too_many_reset_requests",
        )
    limiter.hit(ip)
    PasswordResetService(db, settings).request(body.email, now)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "`invalid_reset_token` (unknown or already used) or "
            "`reset_token_expired`",
        }
    },
)
def reset_password(
    body: ResetPasswordRequest, db: DbSession, settings: AppSettings, now: Now
) -> Response:
    """Set a new password with the token from the reset email.

    Signs the user out everywhere: refresh tokens are revoked and access tokens issued
    before the reset stop working. The user is emailed that the password changed.
    """
    PasswordResetService(db, settings).reset(body.token, body.new_password, now)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
