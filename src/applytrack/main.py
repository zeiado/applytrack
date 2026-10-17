from fastapi import FastAPI

from applytrack import __version__
from applytrack.api.routes import health
from applytrack.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app. Taking settings as an argument keeps tests isolated."""
    settings = settings or get_settings()
    app = FastAPI(title=settings.app_name, version=__version__)
    app.include_router(health.router)
    return app


app = create_app()
