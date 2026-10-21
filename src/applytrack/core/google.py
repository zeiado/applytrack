"""Checking Google ID tokens for "Sign in with Google" (#46, docs/adr/0009-sign-in-with-google.md).

The web app and the Chrome extension get an ID token from Google (the ``credential``
from Google's sign-in button) and send it to the API. It is a JWT signed by Google.
We check the signature against Google's published keys, that it was issued for one of
our client IDs, and that it hasn't expired.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import jwt

from applytrack.core.errors import ServiceUnavailableError, UnauthorizedError

logger = logging.getLogger("applytrack.auth")

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
# Allowed difference between Google's clock and ours.
CLOCK_SKEW_SECONDS = 60


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str  # Google's ID for the account. Never changes, unlike the email.
    email: str
    email_verified: bool


class SigningKeys(Protocol):
    """Finds the public key a token was signed with (``jwt.PyJWKClient`` in production)."""

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK: ...


def google_signing_keys() -> jwt.PyJWKClient:
    # Google rotates its keys every few weeks and publishes new ones in advance. The
    # client caches the key set and fetches it again when a token names an unknown key.
    return jwt.PyJWKClient(GOOGLE_CERTS_URL, cache_jwk_set=True, lifespan=60 * 60, timeout=5)


class GoogleIdTokenVerifier:
    def __init__(self, client_ids: Sequence[str], keys: SigningKeys | None = None) -> None:
        self.client_ids = list(client_ids)
        self.keys = keys if keys is not None else google_signing_keys()

    @property
    def enabled(self) -> bool:
        return bool(self.client_ids)

    def verify(self, token: str) -> GoogleIdentity:
        """The Google account the token belongs to. Raises UnauthorizedError if it's invalid."""
        if not self.enabled:
            raise ServiceUnavailableError(
                "Sign in with Google isn't set up on this server",
                code="google_sign_in_not_configured",
            )
        try:
            key = self.keys.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],  # never let the token choose its own algorithm
                audience=self.client_ids,
                issuer=GOOGLE_ISSUERS,
                leeway=CLOCK_SKEW_SECONDS,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            logger.warning("Couldn't fetch Google's signing keys: %s", exc)
            raise ServiceUnavailableError(
                "Couldn't reach Google to check the sign-in. Try again shortly.",
                code="google_unavailable",
            ) from exc
        except jwt.ExpiredSignatureError as exc:
            raise UnauthorizedError(
                "The Google sign-in has expired. Sign in again.", code="google_token_expired"
            ) from exc
        except jwt.PyJWTError as exc:
            logger.info("Invalid Google ID token: %s", exc)
            raise _invalid() from exc

        email = claims.get("email")
        if not isinstance(email, str) or "@" not in email:
            # Only sent when the client asks for the "email" scope, which we need.
            raise _invalid()
        return GoogleIdentity(
            subject=str(claims["sub"]),
            email=email,
            email_verified=claims.get("email_verified") in (True, "true"),
        )


def _invalid() -> UnauthorizedError:
    return UnauthorizedError("Invalid Google sign-in", code="invalid_google_token")
