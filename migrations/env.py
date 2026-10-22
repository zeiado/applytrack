"""Alembic environment. The database URL comes from app settings, never from alembic.ini."""

from logging.config import fileConfig
from typing import Any

from alembic import context
from sqlalchemy import engine_from_config, pool

from applytrack.core.config import get_settings
from applytrack.models import Base
from applytrack.models.base import UTCDateTime

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

if not config.get_main_option("sqlalchemy.url"):
    config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata

# On PostgreSQL, a migration that can't connect, waits for a lock or loses its connection
# fails within minutes instead of hanging: a hung `alembic upgrade` at startup keeps the
# API from ever listening, and the host gives up on the deploy only after ~15 minutes.
POSTGRES_CONNECT_ARGS = {
    "connect_timeout": 15,
    "options": "-c lock_timeout=60s -c statement_timeout=10min",
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
}


def connect_args(url: str) -> dict[str, Any]:
    return POSTGRES_CONNECT_ARGS if url.startswith("postgresql") else {}


def render_item(type_: str, obj: Any, autogen_context: Any) -> str | bool:
    """Write our UTCDateTime as a plain timezone-aware DateTime, so migrations don't import app code."""
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime(timezone=True)"
    return False


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (``alembic upgrade head --sql``)."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=render_item,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args(config.get_main_option("sqlalchemy.url") or ""),
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_item=render_item,
            render_as_batch=True,  # lets ALTER TABLE work on SQLite too
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
