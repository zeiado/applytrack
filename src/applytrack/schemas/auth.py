import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from applytrack.mail.templates import Locale


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
    created_at: datetime


class EmailTokenRequest(BaseModel):
    """A token from a link in an email (the part after ``#token=``)."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=256)


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
