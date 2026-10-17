import logging

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from applytrack import __version__
from applytrack.api.deps import DbSession

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadyResponse(BaseModel):
    status: str
    database: str


@router.get("/health")
def health() -> HealthResponse:
    """Liveness probe: the process is up and serving requests."""
    return HealthResponse(status="ok", version=__version__)


@router.get(
    "/ready",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": ReadyResponse}},
)
def ready(db: DbSession, response: Response) -> ReadyResponse:
    """Readiness probe: the app can reach its database and is ready for traffic."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Readiness check failed: database unreachable")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadyResponse(status="unavailable", database="unreachable")
    return ReadyResponse(status="ok", database="ok")
