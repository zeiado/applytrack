import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from pydantic import SecretStr, ValidationError

from applytrack.core.config import DEV_JWT_SECRET, Settings
from applytrack.core.errors import UnauthorizedError
from applytrack.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_not_the_password_and_verifies() -> None:
    hashed = hash_password("correct-horse")

    assert hashed != "correct-horse"
    assert hashed.startswith("$argon2")
    assert verify_password("correct-horse", hashed)
    assert not verify_password("wrong-horse", hashed)


def test_verify_password_without_a_hash_is_false() -> None:
    assert verify_password("anything", None) is False


def test_token_round_trip(settings: Settings) -> None:
    user_id = uuid.uuid4()

    assert decode_access_token(create_access_token(user_id, settings), settings) == user_id


def test_expired_token_is_rejected(settings: Settings) -> None:
    old = datetime.now(UTC) - timedelta(minutes=settings.access_token_expire_minutes + 1)
    token = create_access_token(uuid.uuid4(), settings, now=old)

    with pytest.raises(UnauthorizedError) as exc_info:
        decode_access_token(token, settings)
    assert exc_info.value.code == "token_expired"


def test_token_signed_with_another_key_is_rejected(settings: Settings) -> None:
    other = settings.model_copy(update={"jwt_secret_key": SecretStr("x" * 40)})
    token = create_access_token(uuid.uuid4(), other)

    with pytest.raises(UnauthorizedError) as exc_info:
        decode_access_token(token, settings)
    assert exc_info.value.code == "invalid_token"


@pytest.mark.parametrize(
    "claims",
    [
        {"sub": "not-a-uuid", "type": "access"},
        {"sub": str(uuid.uuid4()), "type": "refresh"},
        {"sub": str(uuid.uuid4())},
    ],
    ids=["bad-subject", "wrong-type", "missing-type"],
)
def test_tokens_with_bad_claims_are_rejected(settings: Settings, claims: dict[str, str]) -> None:
    now = datetime.now(UTC)
    payload = {**claims, "iat": now, "exp": now + timedelta(minutes=5)}
    token = jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), "HS256")

    with pytest.raises(UnauthorizedError):
        decode_access_token(token, settings)


def test_unsigned_token_is_rejected(settings: Settings) -> None:
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, key=None, algorithm="none")

    with pytest.raises(UnauthorizedError):
        decode_access_token(token, settings)


@pytest.mark.parametrize("secret", [DEV_JWT_SECRET, "too-short"])
def test_production_refuses_weak_jwt_secret(secret: str) -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=SecretStr(secret))


def test_production_accepts_strong_jwt_secret() -> None:
    settings = Settings(environment="production", jwt_secret_key=SecretStr("s" * 48))
    assert settings.environment == "production"
