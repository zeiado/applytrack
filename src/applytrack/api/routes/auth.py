from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from applytrack.api.deps import AppSettings, DbSession
from applytrack.core.errors import ErrorResponse
from applytrack.core.security import create_access_token
from applytrack.schemas.auth import RegisterRequest, TokenResponse, UserRead
from applytrack.services.auth import AuthService

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


@router.post("/login", responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}})
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
    settings: AppSettings,
) -> TokenResponse:
    """Exchange email and password for an access token.

    Uses the OAuth2 password form (`username` = email) so the Authorize button in /docs works.
    """
    user = AuthService(db).authenticate(form.username, form.password)
    return TokenResponse(
        access_token=create_access_token(user.id, settings),
        expires_in=settings.access_token_expire_minutes * 60,
    )
