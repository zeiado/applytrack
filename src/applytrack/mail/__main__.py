"""Send one test email with the configured backend, skipping the queue.

    python -m applytrack.mail you@example.com --locale ar

Use it to check provider settings (API key, sender domain) before relying on them.
"""

import argparse
import sys
from datetime import UTC, datetime

from applytrack.core.config import get_settings
from applytrack.core.logging import configure_logging
from applytrack.mail.backends import EmailError, EmailMessage, build_email_backend
from applytrack.mail.templates import LOCALES, get_renderer


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m applytrack.mail", description=__doc__)
    parser.add_argument("to", help="recipient address")
    parser.add_argument("--locale", choices=LOCALES, default="en")
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(level="INFO", log_format="text")
    rendered = get_renderer(settings.app_name).render(
        "test", args.locale, {"sent_at": datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")}
    )
    backend = build_email_backend(settings)
    try:
        provider_id = backend.send(
            EmailMessage(
                sender=settings.email_from,
                to=args.to,
                subject=rendered.subject,
                text=rendered.text,
                html=rendered.html,
                reply_to=settings.email_reply_to,
            )
        )
    except EmailError as exc:
        print(f"Failed ({'permanent' if exc.permanent else 'temporary'}): {exc}", file=sys.stderr)
        return 1
    finally:
        backend.close()
    print(f"Sent with the {settings.email_backend} backend (id: {provider_id or '-'})")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
