"""Email templates in Arabic and English (Jinja2), in ``mail/templates/``.

Each email has two files per language:

- ``<name>.<locale>.txt``: the plain-text version. Its first line is ``Subject: ...``.
- ``<name>.<locale>.html``: the HTML version, extending ``_layout.html``.

HTML is autoescaped, and a missing variable is an error instead of an empty string.
Every template also gets ``app_name``, ``locale``, ``dir`` and the logo for its language
(``logo_url``, ``logo_width``, ``logo_height``).
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal, get_args

from jinja2 import (
    Environment,
    FileSystemLoader,
    StrictUndefined,
    TemplateError,
    TemplateNotFound,
    select_autoescape,
)

Locale = Literal["ar", "en"]
LOCALES: tuple[Locale, ...] = get_args(Locale)

TEMPLATE_DIR = Path(__file__).parent / "templates"
_VALID_NAME = re.compile(r"[a-z][a-z0-9_]{0,63}")
_SUBJECT_PREFIX = "Subject: "

# Email logos, served by the web app from web/public/brand/email/. Email apps don't show
# SVG, so these are PNGs at twice the size they're shown at: (file, width, height).
_LOGOS: dict[str, tuple[str, int, int]] = {
    "ar": ("sekka-email-arabic.png", 105, 34),
    "en": ("sekka-email-latin.png", 140, 30),
}


class EmailTemplateError(Exception):
    """A template is missing, broken, or was given the wrong variables. A bug, not
    something a retry fixes."""


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


class EmailRenderer:
    def __init__(
        self, app_name: str, public_app_url: str, template_dir: Path = TEMPLATE_DIR
    ) -> None:
        self.app_name = app_name
        self.public_app_url = public_app_url.rstrip("/")
        self._env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(enabled_extensions=("html",), default=False),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render(self, name: str, locale: str, context: Mapping[str, object]) -> RenderedEmail:
        if not _VALID_NAME.fullmatch(name):
            raise EmailTemplateError(f"Invalid template name {name!r}")
        if locale not in LOCALES:
            raise EmailTemplateError(f"Unsupported locale {locale!r}")
        logo, logo_width, logo_height = _LOGOS[locale]
        variables = {
            **context,
            "app_name": self.app_name,
            "locale": locale,
            "dir": "rtl" if locale == "ar" else "ltr",
            "logo_url": f"{self.public_app_url}/brand/email/{logo}",
            "logo_width": logo_width,
            "logo_height": logo_height,
        }
        try:
            text = self._env.get_template(f"{name}.{locale}.txt").render(variables)
            html = self._env.get_template(f"{name}.{locale}.html").render(variables)
        except TemplateNotFound as exc:
            raise EmailTemplateError(f"No template {exc.name}") from exc
        except TemplateError as exc:  # includes undefined variables
            raise EmailTemplateError(f"Template {name}.{locale}: {exc}") from exc

        first_line, _, body = text.partition("\n")
        if not first_line.startswith(_SUBJECT_PREFIX):
            raise EmailTemplateError(f"{name}.{locale}.txt must start with '{_SUBJECT_PREFIX}'")
        subject = first_line.removeprefix(_SUBJECT_PREFIX).strip()
        return RenderedEmail(subject=subject, text=body.strip() + "\n", html=html)


@lru_cache
def get_renderer(app_name: str, public_app_url: str) -> EmailRenderer:
    """One renderer per app name and URL, so templates are parsed once per process."""
    return EmailRenderer(app_name, public_app_url)
