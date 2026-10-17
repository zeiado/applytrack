from fastapi import APIRouter, status

from applytrack.api.deps import CurrentUser
from applytrack.core.errors import ErrorResponse
from applytrack.schemas.auth import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", responses={status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse}})
def read_me(user: CurrentUser) -> UserRead:
    """The logged-in user."""
    return UserRead.model_validate(user)
