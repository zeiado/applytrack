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

APP_URL = "https://app.example.com/"


def test_english_test_email() -> None:
    email = EmailRenderer("ApplyTrack", APP_URL).render(
        "test", "en", {"sent_at": "2026-10-21 09:00 UTC"}
    )

    assert email.subject == "ApplyTrack test email"
    assert email.text.startswith("Hi,\n")
    assert email.text.endswith("Sent at 2026-10-21 09:00 UTC.\n")
    assert '<html lang="en" dir="ltr">' in email.html
    assert "text-align:left" in email.html
    assert "sending email works" in email.html


def test_arabic_test_email_is_right_to_left() -> None:
    email = EmailRenderer("ApplyTrack", APP_URL).render("test", "ar", {"sent_at": "2026-10-21"})

    assert email.subject == "إيميل تجريبي من ApplyTrack"
    assert email.text.startswith("أهلًا،\n")
    assert '<html lang="ar" dir="rtl">' in email.html
    assert "text-align:right" in email.html
    assert '<span dir="ltr">2026-10-21</span>' in email.html


def test_app_name_comes_from_settings() -> None:
    """The brand isn't final, so templates never hard-code it."""
    email = get_renderer("Sekka", APP_URL).render("test", "en", {"sent_at": "now"})
    assert email.subject == "Sekka test email"
    assert "ApplyTrack" not in email.text + email.html


@pytest.mark.parametrize(
    ("locale", "logo", "width"),
    [("en", "sekka-email-latin.png", 140), ("ar", "sekka-email-arabic.png", 105)],
)
def test_logo_is_a_png_from_the_web_app_in_the_right_script(
    locale: str, logo: str, width: int
) -> None:
    """Email apps don't show SVG, and relative URLs don't work in email."""
    email = EmailRenderer("Sekka", APP_URL).render("test", locale, {"sent_at": "now"})
    assert f'src="https://app.example.com/brand/email/{logo}"' in email.html
    assert f'width="{width}"' in email.html
    assert 'alt="Sekka"' in email.html
    assert (Path(__file__).parents[1] / "web/public/brand/email" / logo).is_file()


def test_header_band_only_when_the_email_has_a_title() -> None:
    renderer = EmailRenderer("Sekka", APP_URL)
    reminder = renderer.render(
        "follow_up_reminder",
        "ar",
        {
            "items": [{"company": "Vodafone", "role_title": "Intern", "days_overdue": 2}],
            "total": 1,
            "more": 0,
            "link": "https://app.example.com/follow-ups",
            "settings_link": "https://app.example.com/settings",
        },
    )
    assert "background-color:#00695A;border-radius:20px 20px 0 0" in reminder.html
    assert "#b91c1c" not in reminder.html  # overdue is calm teal, not alarm red
    plain = renderer.render("test", "en", {"sent_at": "now"})
    assert "border-radius:20px 20px 0 0" not in plain.html


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
    return EmailRenderer("ApplyTrack", APP_URL, template_dir=tmp_path)


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
