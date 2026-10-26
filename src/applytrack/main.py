from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from applytrack import __version__
from applytrack.api.router import api_router
from applytrack.api.routes import health, local_storage
from applytrack.core.analytics import DailyActivity, build_analytics
from applytrack.core.config import Settings, get_settings, resolved_log_format
from applytrack.core.errors import ErrorResponse, register_exception_handlers
from applytrack.core.google import GoogleIdTokenVerifier
from applytrack.core.logging import configure_logging
from applytrack.core.middleware import RequestContextMiddleware
from applytrack.core.observability import init_error_tracking
from applytrack.core.rate_limit import InMemoryRateLimiter, LoginRateLimiter
from applytrack.db.session import build_engine, build_session_factory
from applytrack.jobs.worker import WorkerThread
from applytrack.storage import build_storage
from applytrack.storage.local import LocalStorage
from applytrack.worker import build_worker, warn_if_emails_only_logged


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI app. Taking settings as an argument keeps tests isolated."""
    settings = settings or get_settings()
    engine = build_engine(settings.database_url, echo=settings.database_echo)
    session_factory = build_session_factory(engine)
    storage = build_storage(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        worker_thread = None
        if settings.run_worker_in_api:
            warn_if_emails_only_logged(settings)
            worker_thread = WorkerThread(
                build_worker(settings, session_factory, storage=storage),
                settings.worker_poll_seconds,
            )
            worker_thread.start()
        yield
        if worker_thread is not None:
            worker_thread.stop()
        app.state.analytics.close()
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
    app.state.storage = storage
    app.state.analytics = build_analytics(settings)
    app.state.daily_activity = DailyActivity()
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
    app.state.google_verifier = GoogleIdTokenVerifier(settings.google_client_ids)
    # Invalid Google tokens per IP, with the same limit as failed password logins.
    app.state.google_sign_in_limiter = InMemoryRateLimiter(
        limit=settings.login_max_failures_per_ip, window_seconds=settings.login_window_seconds
    )

    register_exception_handlers(app)
    app.add_middleware(
        RequestContextMiddleware,
        trusted_proxy_hops=settings.trusted_proxy_hops,
        client_ip_secret=(
            settings.client_ip_secret.get_secret_value() if settings.client_ip_secret else None
        ),
    )
    app.include_router(health.router)
    if isinstance(storage, LocalStorage):
        app.include_router(local_storage.router)
    app.include_router(api_router)
    return app


def create_production_app() -> FastAPI:
    """Entry point for uvicorn: configure logging once for the process, then build the app."""
    settings = get_settings()
    configure_logging(level=settings.log_level, log_format=resolved_log_format(settings))
    init_error_tracking(settings, component="api")
    return create_app(settings)


app = create_production_app()
