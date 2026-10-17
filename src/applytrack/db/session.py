from collections.abc import Generator
from typing import Any

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def build_engine(database_url: str, *, echo: bool = False) -> Engine:
    """Create an engine. In-memory SQLite needs one shared connection, so it gets a StaticPool."""
    if database_url.startswith("sqlite"):
        kwargs: dict[str, object] = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in database_url or database_url.endswith("://"):
            kwargs["poolclass"] = StaticPool
        engine = create_engine(database_url, echo=echo, **kwargs)
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
        return engine
    return create_engine(database_url, echo=echo, pool_pre_ping=True)


def build_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db(request: Request) -> Generator[Session]:
    """FastAPI dependency: one session per request, rolled back if the request fails."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _: Any) -> None:
    """SQLite ignores foreign keys (and ON DELETE CASCADE) unless asked, unlike PostgreSQL."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
