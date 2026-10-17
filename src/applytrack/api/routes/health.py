from fastapi import APIRouter
from pydantic import BaseModel

from applytrack import __version__

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str


@router.get("/health")
def health() -> HealthResponse:
    """Liveness probe: the process is up and serving requests."""
    return HealthResponse(status="ok", version=__version__)
