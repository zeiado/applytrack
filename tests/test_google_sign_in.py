"""Sign in with Google (#46): checking ID tokens, linking accounts, and what follows."""

import logging
import re
import time
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

from applytrack.core.config import Settings
from applytrack.core.errors import ServiceUnavailableError, UnauthorizedError
from applytrack.core.google import GOOGLE_CERTS_URL, GoogleIdTokenVerifier
from applytrack.jobs.worker import Worker
from applytrack.mail.backends import MemoryEmailBackend
from applytrack.models import User
from applytrack.repositories.users import UserRepository
from tests.conftest import AuthHelper, error_without_request_id

GOOGLE = "/api/v1/auth/google"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"
ME = "/api/v1/users/me"

CLIENT_ID = "1234-web.apps.googleusercontent.com"
KID = "google-key-1"


@pytest.fixture(scope="module")
def google_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def other_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeGoogleKeys:
    """Stands in for Google's published keys (jwt.PyJWKClient) without the network."""

    def __init__(self, key: rsa.RSAPrivateKey) -> None:
        self.jwk = jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
        self.down = False

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        if self.down:
            raise jwt.PyJWKClientConnectionError("Fail to fetch data from the url")
        if jwt.get_unverified_header(token).get("kid") != KID:
            raise jwt.PyJWKClientError("Unable to find a signing key that matches")
        return jwt.PyJWK({**self.jwk, "kid": KID}, algorithm="RS256")


class Google:
    """Makes ID tokens the way Google signs them."""

    def __init__(self, key: rsa.RSAPrivateKey, keys: FakeGoogleKeys) -> None:
        self.key = key
        self.keys = keys

    def token(
        self,
        sub: str = "google-ada",
        email: str | None = "ada@example.com",
        *,
        key: Any = None,
        algorithm: str = "RS256",
        kid: str = KID,
        drop: tuple[str, ...] = (),
        **claims: Any,
    ) -> str:
        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "azp": CLIENT_ID,
            "sub": sub,
            "email": email,
            "email_verified": True,
            "iat": now,
            "exp": now + 3600,
            **claims,
        }
        payload = {k: v for k, v in payload.items() if k not in drop and v is not None}
        return jwt.encode(
            payload, key if key is not None else self.key, algorithm, headers={"kid": kid}
        )


@pytest.fixture
def settings(settings: Settings) -> Settings:
    return settings.model_copy(update={"google_client_ids": [CLIENT_ID]})


@pytest.fixture
def google(app: FastAPI, google_key: rsa.RSAPrivateKey) -> Google:
    keys = FakeGoogleKeys(google_key)
    app.state.google_verifier = GoogleIdTokenVerifier([CLIENT_ID], keys)
    return Google(google_key, keys)


def sign_in(client: TestClient, id_token: str, **extra: Any) -> Any:
    return client.post(GOOGLE, json={"id_token": id_token, **extra})


def me(client: TestClient, access_token: str) -> dict[str, Any]:
    response = client.get(ME, headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def signed_in(client: TestClient, id_token: str, **extra: Any) -> dict[str, Any]:
    response = sign_in(client, id_token, **extra)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def set_verified(app: FastAPI, email: str = "ada@example.com") -> None:
    with app.state.session_factory() as session:
        session.scalars(
            select(User).where(User.email == email)
        ).one().email_verified_at = datetime.now(UTC)
        session.commit()


def user_count(app: FastAPI) -> int:
    with app.state.session_factory() as session:
        return len(session.scalars(select(User)).all())


# --- New accounts ---------------------------------------------------------------


def test_first_sign_in_creates_a_verified_account_without_password(
    client: TestClient, google: Google
) -> None:
    body = signed_in(client, google.token(email="Ada@Example.com"), locale="ar")

    assert body["token_type"] == "bearer"
    assert body["refresh_token"]
    user = me(client, body["access_token"])
    assert user["email"] == "ada@example.com"
    assert user["email_verified"] is True
    assert user["sign_in_methods"] == ["google"]
    assert user["locale"] == "ar"


def test_tokens_work_like_password_login_tokens(client: TestClient, google: Google) -> None:
    body = signed_in(client, google.token())

    refreshed = client.post(REFRESH, json={"refresh_token": body["refresh_token"]})

    assert refreshed.status_code == 200
    assert me(client, refreshed.json()["access_token"])["email"] == "ada@example.com"


def test_signing_in_again_finds_the_same_account_even_after_an_email_change(
    app: FastAPI, client: TestClient, google: Google
) -> None:
    first = me(client, signed_in(client, google.token())["access_token"])

    again = me(client, signed_in(client, google.token(email="ada@new.example"))["access_token"])

    # Matched by Google's account ID, which doesn't change; the email stays ours.
    assert again["id"] == first["id"]
    assert again["email"] == "ada@example.com"
    assert user_count(app) == 1


def test_password_login_refuses_an_account_without_password(
    client: TestClient, google: Google
) -> None:
    signed_in(client, google.token())

    response = client.post(LOGIN, data={"username": "ada@example.com", "password": "anything"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_account_created_with_google_can_set_a_password_by_email(
    client: TestClient, google: Google, worker: Worker, mailbox: MemoryEmailBackend
) -> None:
    signed_in(client, google.token())

    assert client.post(FORGOT, json={"email": "ada@example.com"}).status_code == 202
    worker.run_pending()
    match = re.search(r"#token=([A-Za-z0-9_-]+)", mailbox.outbox[-1].text)
    assert match is not None
    reset = client.post(RESET, json={"token": match.group(1), "new_password": "new-password"})
    assert reset.status_code == 204

    login = client.post(LOGIN, data={"username": "ada@example.com", "password": "new-password"})
    assert login.status_code == 200
    assert me(client, login.json()["access_token"])["sign_in_methods"] == ["password", "google"]
    # Google keeps working too.
    signed_in(client, google.token())


# --- Linking to an existing account ------------------------------------------------


def test_links_to_the_verified_account_with_the_same_email(
    app: FastAPI, client: TestClient, auth: AuthHelper, google: Google
) -> None:
    registered = auth.register("ada@example.com")
    set_verified(app)

    user = me(client, signed_in(client, google.token(email="ADA@example.com"))["access_token"])

    assert user["id"] == registered["id"]
    assert user["sign_in_methods"] == ["password", "google"]
    assert user_count(app) == 1
    # The password still works.
    auth.login("ada@example.com")


def test_linking_an_unverified_account_removes_the_password_and_its_sessions(
    app: FastAPI,
    client: TestClient,
    auth: AuthHelper,
    google: Google,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Someone registered with Ada's address and never verified it. When Ada signs in
    with Google, the account becomes hers and their password and sessions stop working."""
    registered = auth.register("ada@example.com", "squatter-password")
    login = client.post(
        LOGIN, data={"username": "ada@example.com", "password": "squatter-password"}
    ).json()

    with caplog.at_level(logging.WARNING, logger="applytrack.auth"):
        user = me(client, signed_in(client, google.token())["access_token"])

    assert user["id"] == registered["id"]
    assert user["email_verified"] is True
    assert user["sign_in_methods"] == ["google"]
    old_access = client.get(ME, headers={"Authorization": f"Bearer {login['access_token']}"})
    assert old_access.status_code == 401
    assert old_access.json()["error"]["code"] == "token_revoked"
    assert client.post(REFRESH, json={"refresh_token": login["refresh_token"]}).status_code == 401
    password_login = client.post(
        LOGIN, data={"username": "ada@example.com", "password": "squatter-password"}
    )
    assert password_login.status_code == 401
    assert "password removed" in caplog.text


def test_email_linked_to_another_google_account_is_a_conflict(
    app: FastAPI, client: TestClient, google: Google
) -> None:
    signed_in(client, google.token(sub="google-ada"))

    response = sign_in(client, google.token(sub="google-someone-else"))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "google_account_mismatch"
    assert user_count(app) == 1


def test_simultaneous_first_sign_ins_end_up_with_one_account(
    app: FastAPI, client: TestClient, google: Google, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Another request with the same Google account creates the user after our
    lookups found nothing, so our insert fails. The retry finds that user."""
    with app.state.session_factory() as session:
        session.add(User(email="ada@example.com", password_hash=None, google_subject="google-ada"))
        session.commit()
    lookups: list[str] = []

    def misses_the_first_time(name: str) -> None:
        real = getattr(UserRepository, name)

        def lookup(self: UserRepository, value: str) -> User | None:
            lookups.append(name)
            return None if lookups.count(name) == 1 else real(self, value)

        monkeypatch.setattr(UserRepository, name, lookup)

    misses_the_first_time("get_by_google_subject")
    misses_the_first_time("get_by_email")

    body = signed_in(client, google.token())

    assert me(client, body["access_token"])["email"] == "ada@example.com"
    assert lookups == ["get_by_google_subject", "get_by_email", "get_by_google_subject"]
    assert user_count(app) == 1


# --- Rejected tokens -------------------------------------------------------------


def test_unverified_google_email_is_refused(
    app: FastAPI, client: TestClient, google: Google
) -> None:
    response = sign_in(client, google.token(email_verified=False))

    assert response.status_code == 403
    assert error_without_request_id(response) == {
        "error": {
            "code": "google_email_not_verified",
            "message": "Your Google account's email address isn't verified",
        }
    }
    assert user_count(app) == 0


def test_email_verified_as_a_string_is_accepted(client: TestClient, google: Google) -> None:
    signed_in(client, google.token(email_verified="true"))


@pytest.mark.parametrize(
    "case",
    [
        "other-client",
        "other-issuer",
        "wrong-signature",
        "unknown-key",
        "hs256",
        "no-email",
        "no-sub",
        "not-a-jwt",
    ],
)
def test_invalid_tokens_are_refused(
    app: FastAPI, client: TestClient, google: Google, other_key: rsa.RSAPrivateKey, case: str
) -> None:
    tokens: dict[str, Callable[[], str]] = {
        "other-client": lambda: google.token(aud="999-other.apps.googleusercontent.com"),
        "other-issuer": lambda: google.token(iss="https://evil.example"),
        "wrong-signature": lambda: google.token(key=other_key),
        "unknown-key": lambda: google.token(kid="rotated-away"),
        # Signed with a shared secret (HMAC) instead of Google's RSA key.
        "hs256": lambda: google.token(key="x" * 32, algorithm="HS256"),
        "no-email": lambda: google.token(email=None),
        "no-sub": lambda: google.token(drop=("sub",)),
        "not-a-jwt": lambda: "not-a-jwt",
    }

    response = sign_in(client, tokens[case]())

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_google_token"
    assert response.headers["www-authenticate"] == "Bearer"
    assert user_count(app) == 0


def test_expired_token_says_to_sign_in_again(client: TestClient, google: Google) -> None:
    past = int(time.time()) - 7200

    response = sign_in(client, google.token(iat=past, exp=past + 3600))

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "google_token_expired"


def test_repeated_invalid_tokens_are_rate_limited_per_ip(
    client: TestClient, google: Google, settings: Settings
) -> None:
    for _ in range(settings.login_max_failures_per_ip):
        assert sign_in(client, "not-a-jwt").status_code == 401

    response = sign_in(client, google.token())  # even a valid one waits

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "too_many_login_attempts"
    assert int(response.headers["retry-after"]) > 0


def test_google_unreachable_is_503(client: TestClient, google: Google) -> None:
    google.keys.down = True

    response = sign_in(client, google.token())

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "google_unavailable"


@pytest.mark.parametrize(
    "payload",
    [{}, {"id_token": ""}, {"id_token": "x", "extra": 1}, {"id_token": "x", "locale": "fr"}],
    ids=["missing", "empty", "extra-field", "bad-locale"],
)
def test_input_is_validated(client: TestClient, google: Google, payload: dict[str, Any]) -> None:
    assert client.post(GOOGLE, json=payload).status_code == 422


# --- Not configured / production verifier -------------------------------------------


def test_without_client_ids_google_sign_in_is_off(app: FastAPI, client: TestClient) -> None:
    app.state.google_verifier = GoogleIdTokenVerifier([])

    response = sign_in(client, "anything")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "google_sign_in_not_configured"


def test_the_app_checks_tokens_against_googles_published_keys(app: FastAPI) -> None:
    verifier = app.state.google_verifier

    assert verifier.client_ids == [CLIENT_ID]
    assert isinstance(verifier.keys, jwt.PyJWKClient)
    assert verifier.keys.uri == GOOGLE_CERTS_URL == "https://www.googleapis.com/oauth2/v3/certs"


def test_verifier_returns_the_google_identity(google: Google) -> None:
    verifier = GoogleIdTokenVerifier([CLIENT_ID], google.keys)

    identity = verifier.verify(google.token(sub="12345", email="ada@example.com"))

    assert (identity.subject, identity.email, identity.email_verified) == (
        "12345",
        "ada@example.com",
        True,
    )
    with pytest.raises(UnauthorizedError):
        verifier.verify(google.token(iss="accounts.google.com.evil"))
    with pytest.raises(ServiceUnavailableError):
        GoogleIdTokenVerifier([], google.keys).verify(google.token())


def test_client_ids_setting_is_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "APPLYTRACK_GOOGLE_CLIENT_IDS",
        " 1-web.apps.googleusercontent.com, 2-ext.apps.googleusercontent.com ,",
    )

    assert Settings(environment="test").google_client_ids == [
        "1-web.apps.googleusercontent.com",
        "2-ext.apps.googleusercontent.com",
    ]


def test_client_ids_default_to_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APPLYTRACK_GOOGLE_CLIENT_IDS", "")

    assert Settings(environment="test").google_client_ids == []


def test_something_that_isnt_a_client_id_fails_at_startup() -> None:
    with pytest.raises(ValidationError, match="isn't a Google OAuth client ID"):
        Settings(environment="test", google_client_ids=["GOCSPX-this-is-a-client-secret"])


# --- Deleting an account that has no password -------------------------------------


@pytest.fixture
def ada_google(client: TestClient, google: Google) -> Iterator[dict[str, str]]:
    body = signed_in(client, google.token())
    yield {"Authorization": f"Bearer {body['access_token']}"}


def delete(client: TestClient, headers: dict[str, str], **body: Any) -> Any:
    return client.request("DELETE", ME, json=body, headers=headers)


def test_delete_confirmed_by_signing_in_with_google_again(
    app: FastAPI, client: TestClient, google: Google, ada_google: dict[str, str]
) -> None:
    response = delete(client, ada_google, google_id_token=google.token())

    assert response.status_code == 204
    assert user_count(app) == 0


def test_delete_refuses_another_google_account(
    app: FastAPI, client: TestClient, google: Google, ada_google: dict[str, str]
) -> None:
    response = delete(client, ada_google, google_id_token=google.token(sub="google-mallory"))

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "wrong_google_account"
    assert user_count(app) == 1


def test_delete_refuses_an_invalid_google_token_with_403(
    app: FastAPI, client: TestClient, google: Google, ada_google: dict[str, str]
) -> None:
    response = delete(client, ada_google, google_id_token="not-a-jwt")

    # 403, so the app doesn't think the session expired.
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "invalid_google_token"
    assert user_count(app) == 1


def test_delete_without_a_password_needs_google(
    app: FastAPI, client: TestClient, ada_google: dict[str, str]
) -> None:
    response = delete(client, ada_google, password="guess")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "invalid_password"
    assert user_count(app) == 1


def test_a_new_account_counts_as_a_sign_up(
    app: FastAPI, client: TestClient, google: Google
) -> None:
    from applytrack.core.analytics import MemoryAnalytics

    analytics = MemoryAnalytics()
    app.state.analytics = analytics
    signed_in(client, google.token(), locale="ar")
    signed_in(client, google.token())  # signing in again isn't a sign-up

    sign_ups = [props for _, name, props in analytics.events if name == "signed_up"]
    assert sign_ups == [{"method": "google", "locale": "ar"}]
