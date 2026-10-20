from fastapi import APIRouter, Request, Response, status

from applytrack.api.deps import CurrentUser, DbSession, Now
from applytrack.core.errors import ErrorResponse, ForbiddenError, TooManyRequestsError
from applytrack.core.rate_limit import LoginRateLimiter
from applytrack.schemas.account import AccountExport, DeleteAccountRequest
from applytrack.schemas.auth import UserRead
from applytrack.services.account import AccountService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}})
def read_me(user: CurrentUser) -> UserRead:
    """The logged-in user."""
    return UserRead.model_validate(user)


@router.get("/me/export", responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}})
def export_my_data(user: CurrentUser, db: DbSession, now: Now, response: Response) -> AccountExport:
    """Download everything stored about you: profile, applications, history and interviews."""
    filename = f"applytrack-export-{now.date().isoformat()}.json"
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return AccountService(db, user).export(now)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_403_FORBIDDEN: {"model": ErrorResponse, "description": "Wrong password"},
        status.HTTP_429_TOO_MANY_REQUESTS: {
            "model": ErrorResponse,
            "description": "Too many wrong passwords; see the Retry-After header",
        },
    },
)
def delete_my_account(
    body: DeleteAccountRequest, user: CurrentUser, db: DbSession, request: Request
) -> Response:
    """Permanently delete your account and all its data. Needs your current password.

    Wrong passwords count toward the same limits as failed logins, so a stolen
    access token can't be used to guess the password.
    """
    limiter: LoginRateLimiter = request.app.state.login_limiter
    ip = request.client.host if request.client else "unknown"
    wait = limiter.retry_after(ip, user.email)
    if wait is not None:
        raise TooManyRequestsError(
            f"Too many wrong passwords. Try again in {wait} seconds.",
            retry_after=wait,
            code="too_many_login_attempts",
        )
    try:
        AccountService(db, user).delete(body.password)
    except ForbiddenError:
        limiter.record_failure(ip, user.email)
        raise
    limiter.record_success(ip, user.email)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
