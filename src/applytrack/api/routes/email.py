from fastapi import APIRouter, Response, status

from applytrack.api.deps import AppSettings, DbSession
from applytrack.core.errors import ErrorResponse
from applytrack.schemas.auth import EmailTokenRequest
from applytrack.services.unsubscribe import unsubscribe_from_reminders

router = APIRouter(prefix="/email", tags=["email"])


@router.post(
    "/unsubscribe",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "`invalid_unsubscribe_token`",
        }
    },
)
def unsubscribe(body: EmailTokenRequest, db: DbSession, settings: AppSettings) -> Response:
    """Turn off reminder emails with the token from a reminder email's unsubscribe link.

    No login needed, so it works from the email itself (including one-click unsubscribe
    in Gmail and Yahoo, RFC 8058). Using a link again does nothing more. Account emails
    (verification, password reset) are not affected.
    """
    unsubscribe_from_reminders(db, settings, body.token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
