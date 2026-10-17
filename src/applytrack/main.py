from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from applytrack import __version__
from applytrack.api.routes import health
from applytrack.core.config import Settings, get_settings
from applytrack.db.session import build_engine, build_session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app. Taking settings as an argument keeps tests isolated."""
    settings = settings or get_settings()
    engine = build_engine(settings.database_url, echo=settings.database_echo)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = build_session_factory(engine)

    app.include_router(health.router)
    return app


app = create_app()
