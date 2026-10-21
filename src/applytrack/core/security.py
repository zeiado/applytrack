"""Password hashing, JWT access tokens, and random tokens (refresh tokens, email links).

See docs/adr/0003-jwt-authentication.md and docs/adr/0006-rotating-refresh-tokens.md.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from applytrack.core.config import Settings
from applytrack.core.errors import UnauthorizedError

_password_hash = PasswordHash.recommended()  # Argon2id

# Compared against when an email doesn't exist, so a login takes the same time
# whether or not the account exists (prevents finding valid emails by timing).
_DUMMY_HASH = _password_hash.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _password_hash.verify(password, _DUMMY_HASH)
        return False
    return _password_hash.verify(password, password_hash)


def create_access_token(
    user_id: uuid.UUID, settings: Settings, *, now: datetime | None = None
) -> str:
    issued_at = now or datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        # Fractional seconds (allowed by RFC 7519), so a token issued just before a
        # password reset can be told apart from one issued just after it.
        "iat": issued_at.timestamp(),
        "exp": issued_at + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), settings.jwt_algorithm)


@dataclass(frozen=True)
class AccessTokenClaims:
    user_id: uuid.UUID
    issued_at: datetime


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    """Return the claims of a valid token, or raise UnauthorizedError."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "iat"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired", code="token_expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid token", code="invalid_token") from exc

    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token", code="invalid_token")
    try:
        return AccessTokenClaims(
            user_id=uuid.UUID(payload["sub"]),
            issued_at=datetime.fromtimestamp(float(payload["iat"]), UTC),
        )
    except (ValueError, TypeError) as exc:
        raise UnauthorizedError("Invalid token", code="invalid_token") from exc


def new_random_token() -> str:
    """A random, URL-safe token with 256 bits of entropy (refresh tokens, email links)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex digest. A fast hash is enough here: the token is random, not a password."""
    return hashlib.sha256(token.encode()).hexdigest()
