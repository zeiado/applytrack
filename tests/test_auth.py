import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from applytrack.core.config import Settings
from applytrack.core.security import create_access_token
from tests.conftest import AuthHelper, error_without_request_id

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
ME = "/api/v1/users/me"


# --- Register ---------------------------------------------------------------


def test_register_creates_user_without_exposing_password(client: TestClient) -> None:
    response = client.post(
        REGISTER, json={"email": "Ada@Example.com ", "password": "correct-horse"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@example.com"  # normalized
    assert set(body) == {
        "id",
        "email",
        "email_verified",
        "locale",
        "timezone",
        "reminder_emails",
        "sign_in_methods",
        "created_at",
    }
    assert body["sign_in_methods"] == ["password"]
    assert (body["timezone"], body["reminder_emails"]) == ("Africa/Cairo", True)
    assert body["email_verified"] is False
    assert body["locale"] == "en"


def test_register_duplicate_email_is_conflict_ignoring_case(
    client: TestClient, auth: AuthHelper
) -> None:
    auth.register("ada@example.com")

    response = client.post(REGISTER, json={"email": "ADA@example.com", "password": "another-pass"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"email": "not-an-email", "password": "correct-horse"}, "body.email"),
        ({"email": "ada@example.com", "password": "short"}, "body.password"),
        ({"email": "ada@example.com", "password": "x" * 129}, "body.password"),
        ({"password": "correct-horse"}, "body.email"),
    ],
    ids=["invalid-email", "short-password", "long-password", "missing-email"],
)
def test_register_validates_input(client: TestClient, payload: dict[str, str], field: str) -> None:
    response = client.post(REGISTER, json=payload)

    assert response.status_code == 422
    assert [d["field"] for d in response.json()["error"]["details"]] == [field]


# --- Login ------------------------------------------------------------------


def test_login_returns_bearer_token(
    client: TestClient, auth: AuthHelper, settings: Settings
) -> None:
    auth.register()

    response = client.post(LOGIN, data={"username": "ADA@example.com", "password": "correct-horse"})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.access_token_expire_minutes * 60
    assert body["access_token"]


@pytest.mark.parametrize(
    ("email", "password"),
    [("ada@example.com", "wrong-horse"), ("nobody@example.com", "correct-horse")],
    ids=["wrong-password", "unknown-email"],
)
def test_login_failures_look_the_same(
    client: TestClient, auth: AuthHelper, email: str, password: str
) -> None:
    auth.register()

    response = client.post(LOGIN, data={"username": email, "password": password})

    assert response.status_code == 401
    assert error_without_request_id(response) == {
        "error": {"code": "invalid_credentials", "message": "Incorrect email or password"}
    }


# --- Current user -----------------------------------------------------------


def test_me_returns_current_user(client: TestClient, auth: AuthHelper) -> None:
    user = auth.register()

    response = client.get(ME, headers={"Authorization": f"Bearer {auth.login()}"})

    assert response.status_code == 200
    assert response.json() == user


def test_me_without_token_is_unauthorized(client: TestClient) -> None:
    response = client.get(ME)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "not_authenticated"


def test_me_with_garbage_token_is_unauthorized(client: TestClient) -> None:
    response = client.get(ME, headers={"Authorization": "Bearer not.a.jwt"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"


def test_me_with_expired_token_is_unauthorized(
    client: TestClient, auth: AuthHelper, settings: Settings
) -> None:
    user_id = uuid.UUID(auth.register()["id"])
    old = datetime.now(UTC) - timedelta(hours=1)
    token = create_access_token(user_id, settings, now=old)

    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "token_expired"


def test_me_with_token_for_missing_user_is_unauthorized(
    client: TestClient, settings: Settings
) -> None:
    token = create_access_token(uuid.uuid4(), settings)

    response = client.get(ME, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_token"
