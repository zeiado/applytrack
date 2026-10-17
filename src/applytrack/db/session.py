from collections.abc import Generator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def build_engine(database_url: str, *, echo: bool = False) -> Engine:
    """Create an engine. In-memory SQLite needs one shared connection, so it gets a StaticPool."""
    if database_url.startswith("sqlite"):
        kwargs: dict[str, object] = {"connect_args": {"check_same_thread": False}}
        if ":memory:" in database_url or database_url.endswith("://"):
            kwargs["poolclass"] = StaticPool
        return create_engine(database_url, echo=echo, **kwargs)
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
