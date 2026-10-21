import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from applytrack.mail.templates import Locale
from applytrack.schemas.timezones import Timezone


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    locale: Locale = Field(default="en", description="Language for emails: ar or en")


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    email_verified: bool = Field(description="Whether the user opened the verification link")
    locale: Locale
    timezone: str = Field(description="IANA name; reminder emails arrive in its morning")
    reminder_emails: bool = Field(description="Whether to get a morning email of due follow-ups")
    sign_in_methods: list[Literal["password", "google"]] = Field(
        description="How the user can sign in. Without `password`, offer to set one "
        "(the forgot-password email sets it)"
    )
    created_at: datetime


class UserUpdate(BaseModel):
    """Fields you can change. Leave a field out to keep it."""

    model_config = ConfigDict(extra="forbid")

    locale: Locale | None = None
    timezone: Timezone | None = None
    reminder_emails: bool | None = None


class EmailTokenRequest(BaseModel):
    """A token from a link in an email (the part after ``#token=``)."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=256)


class GoogleSignInRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id_token: str = Field(
        min_length=1,
        max_length=4096,
        description="The ID token from Google's sign-in button (its `credential`)",
    )
    locale: Locale = Field(
        default="en", description="Language for emails, if this creates the account"
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105 (OAuth2 token type, not a secret)
    expires_in: int = Field(description="Seconds until the access token expires")
    refresh_token: str = Field(
        description="Send to /auth/refresh for a new pair. Single use: each refresh replaces it"
    )
    refresh_expires_in: int = Field(description="Seconds until the refresh token expires")


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=1, max_length=256)


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=256, description="From the link in the email")
    new_password: str = Field(min_length=8, max_length=128)
