from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables (prefix ``APPLYTRACK_``) or a .env file."""

    model_config = SettingsConfigDict(env_prefix="APPLYTRACK_", env_file=".env", extra="ignore")

    app_name: str = "ApplyTrack"
    environment: Literal["local", "test", "production"] = "local"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://applytrack:applytrack@localhost:5432/applytrack"
    database_echo: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
