from email.utils import parseaddr
from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Only for local development and tests. Production refuses to start with it.
DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"  # noqa: S105


class Settings(BaseSettings):
    """App settings, read from environment variables (prefix ``APPLYTRACK_``) or a .env file."""

    model_config = SettingsConfigDict(env_prefix="APPLYTRACK_", env_file=".env", extra="ignore")

    app_name: str = "ApplyTrack"
    environment: Literal["local", "test", "production"] = "local"
    log_level: str = "INFO"
    log_format: Literal["auto", "json", "text"] = "auto"  # auto: json in production, else text
    database_url: str = "postgresql+psycopg://applytrack:applytrack@localhost:5432/applytrack"
    database_echo: bool = False

    jwt_secret_key: SecretStr = SecretStr(DEV_JWT_SECRET)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Failed-login limits (see ADR 0005)
    login_max_failures_per_account: int = 5
    login_max_failures_per_ip: int = 20
    login_window_seconds: int = 60

    # Reverse proxies in front of the app that append to X-Forwarded-For (0 = none).
    # See core/client_ip.py. Measure it for a host; never guess.
    trusted_proxy_hops: int = Field(default=0, ge=0, le=10)

    # The web app. Links in emails point here (e.g. <url>/verify-email#token=...).
    public_app_url: str = "http://localhost:3000"
    # One-time email links (docs/adr/0008-one-time-email-tokens.md)
    email_verification_expire_hours: int = Field(default=24, ge=1, le=168)
    # Emails of one kind (verification, password reset) per account per hour
    email_token_limit_per_hour: int = Field(default=3, ge=1, le=20)

    # Email (docs/adr/0007-database-job-queue-and-email.md).
    # console writes emails to the log instead of sending them.
    email_backend: Literal["console", "resend", "smtp"] = "console"
    email_from: str = "ApplyTrack <noreply@localhost>"
    email_reply_to: str | None = None
    email_timeout_seconds: float = Field(default=10, gt=0, le=60)
    resend_api_key: SecretStr | None = None
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    smtp_security: Literal["starttls", "tls", "none"] = "starttls"

    # Background jobs (ADR 0007). Run the worker as its own process (python -m
    # applytrack.worker), or inside the API process where separate workers cost extra.
    run_worker_in_api: bool = False
    worker_poll_seconds: float = Field(default=2, gt=0, le=60)
    job_max_attempts: int = Field(default=5, ge=1, le=20)

    @field_validator("public_app_url")
    @classmethod
    def _http_url_without_trailing_slash(cls, url: str) -> str:
        if not url.startswith(("https://", "http://")):
            raise ValueError("APPLYTRACK_PUBLIC_APP_URL must start with https:// or http://")
        return url.rstrip("/")

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> Self:
        secret = self.jwt_secret_key.get_secret_value()
        if self.environment == "production" and (secret == DEV_JWT_SECRET or len(secret) < 32):
            raise ValueError(
                "APPLYTRACK_JWT_SECRET_KEY must be set to a random 32+ character value"
            )
        return self

    @model_validator(mode="after")
    def _require_complete_email_settings(self) -> Self:
        """Fail at startup, not on the first email, when a provider is half configured."""
        _, sender = parseaddr(self.email_from)
        if "@" not in sender:
            raise ValueError("APPLYTRACK_EMAIL_FROM must be an address like 'Name <a@b.com>'")
        if self.email_backend == "console":
            return self
        if sender.endswith("@localhost"):
            raise ValueError("Set APPLYTRACK_EMAIL_FROM to an address on your sending domain")
        if self.email_backend == "resend" and not self.resend_api_key:
            raise ValueError("APPLYTRACK_EMAIL_BACKEND=resend needs APPLYTRACK_RESEND_API_KEY")
        if self.email_backend == "smtp":
            if not self.smtp_host:
                raise ValueError("APPLYTRACK_EMAIL_BACKEND=smtp needs APPLYTRACK_SMTP_HOST")
            if self.environment == "production" and self.smtp_security == "none":
                raise ValueError("APPLYTRACK_SMTP_SECURITY=none would send passwords in clear")
        return self


def resolved_log_format(settings: Settings) -> Literal["json", "text"]:
    if settings.log_format == "auto":
        return "json" if settings.environment == "production" else "text"
    return settings.log_format


@lru_cache
def get_settings() -> Settings:
    return Settings()
