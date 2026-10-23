"""Turning off reminder emails from the link in one (#71)."""

import logging

from sqlalchemy.orm import Session

from applytrack.core.config import Settings
from applytrack.core.errors import AppError
from applytrack.core.security import create_unsubscribe_token, read_unsubscribe_token
from applytrack.models import User

logger = logging.getLogger("applytrack.reminders")


def unsubscribe_links(user: User, settings: Settings) -> tuple[str, str]:
    """(page, one_click): the link shown in the email, which opens a page with a
    button, and the address for the List-Unsubscribe header, which turns reminders off
    when an email app sends it a POST. Opening the first link changes nothing, so link
    scanners that open every link in an email can't unsubscribe anyone."""
    token = create_unsubscribe_token(user.id, settings)
    locale = "ar" if user.locale == "ar" else "en"
    return (
        f"{settings.public_app_url}/{locale}/unsubscribe#token={token}",
        f"{settings.public_app_url}/api/unsubscribe?token={token}",
    )


def unsubscribe_from_reminders(session: Session, settings: Settings, token: str) -> None:
    user_id = read_unsubscribe_token(token, settings)
    if user_id is None:
        raise AppError("This unsubscribe link is not valid", code="invalid_unsubscribe_token")
    user = session.get(User, user_id)
    # A deleted account has nothing left to unsubscribe; say it worked.
    if user is not None and user.reminder_emails:
        user.reminder_emails = False
        session.commit()
        logger.info("Reminder emails turned off from an email link")
