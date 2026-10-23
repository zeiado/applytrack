"""Error tracking (#70): Sentry is off without a DSN, and events lose personal data
before they leave the server."""

from typing import Any
from unittest.mock import patch

from applytrack.core.config import Settings
from applytrack.core.observability import (
    init_error_tracking,
    mask_emails,
    scrub_breadcrumb,
    scrub_event,
)


def test_off_without_a_dsn(settings: Settings) -> None:
    with patch("sentry_sdk.init") as init:
        assert init_error_tracking(settings, component="api") is False
    init.assert_not_called()


def test_on_with_a_dsn_and_no_personal_data(settings: Settings) -> None:
    on = settings.model_copy(update={"sentry_dsn": "https://key@o1.ingest.sentry.io/1"})
    with patch("sentry_sdk.init") as init:
        assert init_error_tracking(on, component="worker") is True
    options = init.call_args.kwargs
    assert options["send_default_pii"] is False
    assert options["max_request_body_size"] == "never"
    assert options["before_send"] is scrub_event
    assert options["environment"] == "test"


def test_events_lose_personal_data() -> None:
    event: dict[str, Any] = {
        "user": {"email": "ada@example.com", "ip_address": "1.2.3.4"},
        "request": {
            "url": "https://api.example.com/api/v1/email/unsubscribe?token=secret",
            "query_string": "token=secret",
            "data": {"password": "hunter2"},
            "cookies": {"session": "abc"},
            "env": {"REMOTE_ADDR": "1.2.3.4"},
            "headers": {
                "Authorization": "Bearer abc",
                "Cookie": "a=b",
                "X-Proxy-Secret": "s",
                "X-Client-IP": "1.2.3.4",
                "User-Agent": "Mozilla",
            },
        },
        "extra": {"to": "a***@example.com", "user_id": "42"},
        "logentry": {"message": "Failed for ada@example.com", "params": ["ada@example.com"]},
        "exception": {"values": [{"value": "Key (email)=(ada@example.com) already exists"}]},
    }

    scrubbed = scrub_event(event, {})

    assert "user" not in scrubbed
    assert scrubbed["request"] == {
        "url": "https://api.example.com/api/v1/email/unsubscribe",
        "headers": {"User-Agent": "Mozilla"},
    }
    assert scrubbed["extra"] == {"to": "[removed]", "user_id": "42"}
    assert scrubbed["logentry"] == {"message": "Failed for [email]"}
    assert scrubbed["exception"]["values"][0]["value"] == "Key (email)=([email]) already exists"
    assert "ada@" not in repr(scrubbed)
    assert "secret" not in repr(scrubbed)


def test_breadcrumbs_lose_emails_and_skip_logged_emails() -> None:
    assert scrub_breadcrumb({"category": "applytrack.mail", "message": "To: x"}, {}) is None
    crumb = scrub_breadcrumb(
        {"category": "applytrack.auth", "message": "Login ada@example.com", "data": {"a": 1}}, {}
    )
    assert crumb == {"category": "applytrack.auth", "message": "Login [email]"}


def test_mask_emails() -> None:
    assert mask_emails("a.b+c@mail.example.co.uk and x@y.io") == "[email] and [email]"
    assert mask_emails("no address here @ all") == "no address here @ all"
