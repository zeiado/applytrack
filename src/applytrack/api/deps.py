from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from applytrack.core.analytics import Analytics, DailyActivity
from applytrack.core.config import Settings
from applytrack.core.errors import UnauthorizedError
from applytrack.core.security import decode_access_token
from applytrack.db.session import get_db
from applytrack.models import User
from applytrack.repositories.users import UserRepository
from applytrack.storage import ObjectStorage

DbSession = Annotated[Session, Depends(get_db)]

# auto_error=False so a missing token goes through our own 401 error format.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_settings_from_app(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


AppSettings = Annotated[Settings, Depends(get_settings_from_app)]


def get_analytics(request: Request) -> Analytics:
    analytics: Analytics = request.app.state.analytics
    return analytics


AppAnalytics = Annotated[Analytics, Depends(get_analytics)]


def get_now() -> datetime:
    """The current time. A dependency, so tests can freeze it with dependency_overrides."""
    return datetime.now(UTC)


Now = Annotated[datetime, Depends(get_now)]


def get_storage(request: Request) -> ObjectStorage | None:
    """Where uploaded files are kept; None when uploads are off."""
    storage: ObjectStorage | None = request.app.state.storage
    return storage


Storage = Annotated[ObjectStorage | None, Depends(get_storage)]


def get_current_user(
    request: Request,
    db: DbSession,
    settings: AppSettings,
    analytics: AppAnalytics,
    now: Now,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> User:
    if token is None:
        raise UnauthorizedError("Not authenticated", code="not_authenticated")
    claims = decode_access_token(token, settings)
    user = UserRepository(db).get(claims.user_id)
    if user is None:
        raise UnauthorizedError("Invalid token", code="invalid_token")
    # Tokens issued before a password reset stop working (ADR 0008).
    if user.password_changed_at is not None and claims.issued_at < user.password_changed_at:
        raise UnauthorizedError("Token was revoked; log in again", code="token_revoked")
    activity: DailyActivity = request.app.state.daily_activity
    activity.record(analytics, user.id, now.date())
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
