from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from applytrack import __version__
from applytrack.api.router import api_router
from applytrack.api.routes import health
from applytrack.core.config import Settings, get_settings
from applytrack.core.errors import ErrorResponse, register_exception_handlers
from applytrack.db.session import build_engine, build_session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app. Taking settings as an argument keeps tests isolated."""
    settings = settings or get_settings()
    engine = build_engine(settings.database_url, echo=settings.database_echo)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        lifespan=lifespan,
        responses={
            422: {"model": ErrorResponse, "description": "Validation error"},
            500: {"model": ErrorResponse, "description": "Unexpected error"},
        },
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = build_session_factory(engine)

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_router)
    return app


app = create_app()
