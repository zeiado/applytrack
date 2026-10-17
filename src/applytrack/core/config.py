from functools import lru_cache
from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Only for local development and tests. Production refuses to start with it.
DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"  # noqa: S105


class Settings(BaseSettings):
    """App settings, read from environment variables (prefix ``APPLYTRACK_``) or a .env file."""

    model_config = SettingsConfigDict(env_prefix="APPLYTRACK_", env_file=".env", extra="ignore")

    app_name: str = "ApplyTrack"
    environment: Literal["local", "test", "production"] = "local"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://applytrack:applytrack@localhost:5432/applytrack"
    database_echo: bool = False

    jwt_secret_key: SecretStr = SecretStr(DEV_JWT_SECRET)
    jwt_algorithm: Literal["HS256"] = "HS256"
    access_token_expire_minutes: int = 30

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> Self:
        secret = self.jwt_secret_key.get_secret_value()
        if self.environment == "production" and (secret == DEV_JWT_SECRET or len(secret) < 32):
            raise ValueError(
                "APPLYTRACK_JWT_SECRET_KEY must be set to a random 32+ character value"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
