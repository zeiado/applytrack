from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from applytrack import __version__
from applytrack.api.router import api_router
from applytrack.api.routes import health
from applytrack.core.config import Settings, get_settings, resolved_log_format
from applytrack.core.errors import ErrorResponse, register_exception_handlers
from applytrack.core.logging import configure_logging
from applytrack.core.middleware import RequestContextMiddleware
from applytrack.core.rate_limit import InMemoryRateLimiter, LoginRateLimiter
from applytrack.db.session import build_engine, build_session_factory
from applytrack.jobs.worker import WorkerThread
from applytrack.worker import build_worker, warn_if_emails_only_logged


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app. Taking settings as an argument keeps tests isolated."""
    settings = settings or get_settings()
    engine = build_engine(settings.database_url, echo=settings.database_echo)
    session_factory = build_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        worker_thread = None
        if settings.run_worker_in_api:
            warn_if_emails_only_logged(settings)
            worker_thread = WorkerThread(
                build_worker(settings, session_factory), settings.worker_poll_seconds
            )
            worker_thread.start()
        yield
        if worker_thread is not None:
            worker_thread.stop()
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
    app.state.session_factory = session_factory
    app.state.login_limiter = LoginRateLimiter(
        per_account=InMemoryRateLimiter(
            limit=settings.login_max_failures_per_account,
            window_seconds=settings.login_window_seconds,
        ),
        per_ip=InMemoryRateLimiter(
            limit=settings.login_max_failures_per_ip,
            window_seconds=settings.login_window_seconds,
        ),
    )

    app.state.forgot_password_limiter = InMemoryRateLimiter(
        limit=settings.forgot_password_max_per_ip, window_seconds=60 * 60
    )

    register_exception_handlers(app)
    app.add_middleware(RequestContextMiddleware, trusted_proxy_hops=settings.trusted_proxy_hops)
    app.include_router(health.router)
    app.include_router(api_router)
    return app


def create_production_app() -> FastAPI:
    """Entry point for uvicorn: configure logging once for the process, then build the app."""
    settings = get_settings()
    configure_logging(level=settings.log_level, log_format=resolved_log_format(settings))
    return create_app(settings)


app = create_production_app()
