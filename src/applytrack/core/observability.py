"""Error tracking with Sentry (#70). Off unless APPLYTRACK_SENTRY_DSN is set.

Events carry no personal data (docs/privacy.md): no request bodies, cookies, query
strings (email links carry tokens), IP addresses or users, only a few harmless headers,
and email addresses are masked wherever they appear in messages.
"""

import re
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.logging import ignore_logger

from applytrack import __version__
from applytrack.core.config import Settings

_KEEP_HEADERS = {"accept", "content-type", "user-agent", "x-request-id"}
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
# Log fields that name a person (e.g. ``to`` on "Email handed to the backend").
_PERSONAL_EXTRAS = {"to", "email"}
# The console email backend logs whole emails, links and tokens included.
_SKIP_BREADCRUMB_LOGGERS = {"applytrack.mail"}


def init_error_tracking(settings: Settings, *, component: str) -> bool:
    """Start Sentry for this process (``api`` or ``worker``). Returns whether it's on."""
    if not settings.sentry_dsn:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=f"applytrack@{__version__}",
        send_default_pii=False,
        max_request_body_size="never",
        traces_sample_rate=settings.sentry_traces_sample_rate,
        before_send=scrub_event,
        before_send_transaction=scrub_event,
        before_breadcrumb=scrub_breadcrumb,
    )
    sentry_sdk.get_global_scope().set_tag("component", component)
    # The access log line for a 500 repeats what the error log already reported, with
    # the traceback; one event per error is enough.
    ignore_logger("applytrack.access")
    return True


def mask_emails(text: str) -> str:
    return _EMAIL.sub("[email]", text)


def scrub_event(event: Any, _hint: Any) -> Any:
    """Remove personal data from an event before it leaves the server."""
    event.pop("user", None)
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "cookies", "query_string", "env"):
            request.pop(key, None)
        if isinstance(request.get("url"), str):
            request["url"] = request["url"].split("?")[0].split("#")[0]
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if k.lower() in _KEEP_HEADERS}
    extra = event.get("extra")
    if isinstance(extra, dict):
        for key in _PERSONAL_EXTRAS & extra.keys():
            extra[key] = "[removed]"
    logentry = event.get("logentry")
    if isinstance(logentry, dict):
        for key in ("message", "formatted"):
            if isinstance(logentry.get(key), str):
                logentry[key] = mask_emails(logentry[key])
        logentry.pop("params", None)
    for exception in (event.get("exception") or {}).get("values") or []:
        if isinstance(exception.get("value"), str):
            exception["value"] = mask_emails(exception["value"])
    return event


def scrub_breadcrumb(crumb: Any, _hint: Any) -> Any:
    if crumb.get("category") in _SKIP_BREADCRUMB_LOGGERS:
        return None
    crumb.pop("data", None)
    if isinstance(crumb.get("message"), str):
        crumb["message"] = mask_emails(crumb["message"])
    return crumb
