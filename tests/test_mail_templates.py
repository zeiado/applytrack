"""Email templates (Arabic and English) and the email settings checks."""

from pathlib import Path
from typing import Any

import pytest
from pydantic import SecretStr, ValidationError

from applytrack.core.config import Settings
from applytrack.mail.templates import (
    LOCALES,
    TEMPLATE_DIR,
    EmailRenderer,
    EmailTemplateError,
    get_renderer,
)


def test_english_test_email() -> None:
    email = EmailRenderer("ApplyTrack").render("test", "en", {"sent_at": "2026-10-21 09:00 UTC"})

    assert email.subject == "ApplyTrack test email"
    assert email.text.startswith("Hi,\n")
    assert email.text.endswith("Sent at 2026-10-21 09:00 UTC.\n")
    assert '<html lang="en" dir="ltr">' in email.html
    assert "text-align:left" in email.html
    assert "sending email works" in email.html


def test_arabic_test_email_is_right_to_left() -> None:
    email = EmailRenderer("ApplyTrack").render("test", "ar", {"sent_at": "2026-10-21"})

    assert email.subject == "رسالة تجريبية من ApplyTrack"
    assert email.text.startswith("مرحبًا،\n")
    assert '<html lang="ar" dir="rtl">' in email.html
    assert "text-align:right" in email.html
    assert '<span dir="ltr">2026-10-21</span>' in email.html


def test_app_name_comes_from_settings() -> None:
    """The brand isn't final, so templates never hard-code it."""
    email = get_renderer("Sekka").render("test", "en", {"sent_at": "now"})
    assert email.subject == "Sekka test email"
    assert "ApplyTrack" not in email.text + email.html


def test_every_email_exists_in_every_language_and_format() -> None:
    files = {p.name for p in TEMPLATE_DIR.iterdir() if not p.name.startswith("_")}
    names = {name.split(".")[0] for name in files}
    expected = {f"{n}.{loc}.{ext}" for n in names for loc in LOCALES for ext in ("txt", "html")}
    assert files == expected


@pytest.fixture
def custom(tmp_path: Path) -> EmailRenderer:
    (tmp_path / "hello.en.txt").write_text("Subject: Hi {{ name }}\n\nHello {{ name }}\n", "utf-8")
    (tmp_path / "hello.en.html").write_text("<p>Hello {{ name }}</p>", "utf-8")
    (tmp_path / "nosubject.en.txt").write_text("Hello\n", "utf-8")
    (tmp_path / "nosubject.en.html").write_text("<p>Hello</p>", "utf-8")
    (tmp_path / "broken.en.txt").write_text("Subject: {% if %}\n", "utf-8")
    return EmailRenderer("ApplyTrack", template_dir=tmp_path)


def test_html_is_escaped_and_text_is_not(custom: EmailRenderer) -> None:
    email = custom.render("hello", "en", {"name": "<b>Tom & Jerry</b>"})

    assert email.html == "<p>Hello &lt;b&gt;Tom &amp; Jerry&lt;/b&gt;</p>"
    assert email.text == "Hello <b>Tom & Jerry</b>\n"
    assert email.subject == "Hi <b>Tom & Jerry</b>"


@pytest.mark.parametrize(
    ("name", "locale", "context", "error"),
    [
        ("hello", "en", {}, "'name' is undefined"),
        ("hello", "ar", {"name": "x"}, "No template hello.ar.txt"),
        ("hello", "fr", {"name": "x"}, "Unsupported locale 'fr'"),
        ("../secrets", "en", {}, "Invalid template name"),
        ("Hello", "en", {}, "Invalid template name"),
        ("nosubject", "en", {}, "must start with 'Subject: '"),
        ("broken", "en", {}, "Template broken.en"),
    ],
)
def test_template_errors(
    custom: EmailRenderer, name: str, locale: str, context: dict[str, str], error: str
) -> None:
    with pytest.raises(EmailTemplateError, match=error.replace(".", r"\.")):
        custom.render(name, locale, context)


# ---- Settings ----------------------------------------------------------------------


def make(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_console_is_the_default_and_needs_nothing() -> None:
    settings = make()
    assert settings.email_backend == "console"
    assert settings.run_worker_in_api is False


@pytest.mark.parametrize(
    ("overrides", "error"),
    [
        ({"email_from": "not an address"}, "APPLYTRACK_EMAIL_FROM must be an address"),
        ({"email_backend": "resend", "resend_api_key": "re_1"}, "address on your sending domain"),
        ({"email_backend": "resend", "email_from": "a@applytrack.app"}, "RESEND_API_KEY"),
        ({"email_backend": "smtp", "email_from": "a@applytrack.app"}, "SMTP_HOST"),
        (
            {
                "email_backend": "smtp",
                "email_from": "a@applytrack.app",
                "smtp_host": "smtp.example.com",
                "smtp_security": "none",
                "environment": "production",
                "jwt_secret_key": "x" * 40,
            },
            "would send passwords in clear",
        ),
    ],
)
def test_incomplete_email_settings_fail_at_startup(
    overrides: dict[str, object], error: str
) -> None:
    with pytest.raises(ValidationError, match=error):
        make(**overrides)


def test_complete_provider_settings_are_accepted() -> None:
    resend = make(
        email_backend="resend",
        email_from="ApplyTrack <noreply@applytrack.app>",
        resend_api_key=SecretStr("re_123"),
    )
    assert resend.email_backend == "resend"
    smtp = make(email_backend="smtp", email_from="a@applytrack.app", smtp_host="smtp.example.com")
    assert smtp.smtp_security == "starttls"
