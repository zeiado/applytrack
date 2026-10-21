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

    issued = (datetime.now(UTC) - timedelta(seconds=5)).replace(microsecond=750_000)
    token = create_access_token(user_id, settings, now=issued)

    claims = decode_access_token(token, settings)
    assert claims.user_id == user_id
    assert abs(claims.issued_at - issued) < timedelta(milliseconds=1)  # sub-second precision


def test_tokens_with_whole_second_iat_still_work(settings: Settings) -> None:
    """Tokens issued before iat became fractional stay valid until they expire."""
    user_id = uuid.uuid4()
    now = int(datetime.now(UTC).timestamp())
    payload = {"sub": str(user_id), "iat": now, "exp": now + 60, "type": "access"}
    token = jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), "HS256")

    assert decode_access_token(token, settings).issued_at == datetime.fromtimestamp(now, UTC)


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
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "access"}, key="", algorithm="none")

    with pytest.raises(UnauthorizedError):
        decode_access_token(token, settings)


@pytest.mark.parametrize("secret", [DEV_JWT_SECRET, "too-short"])
def test_production_refuses_weak_jwt_secret(secret: str) -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=SecretStr(secret))


def test_production_accepts_strong_jwt_secret() -> None:
    settings = Settings(environment="production", jwt_secret_key=SecretStr("s" * 48))
    assert settings.environment == "production"


@pytest.mark.real_hashing
def test_production_hasher_uses_secure_argon2_settings() -> None:
    """The fast test hasher must never be what the app really uses."""
    hashed = hash_password("x")

    assert hashed.startswith("$argon2id$")
    assert "m=65536,t=3" in hashed  # pwdlib's recommended memory and time cost
