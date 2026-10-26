"""Upload and download links for LocalStorage (development and end-to-end tests only).

Behaves like a bucket's signed links: the browser uploads from the web app's origin,
so uploads answer CORS like the R2 bucket does (docs/deployment.md).
"""

from pathlib import Path

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import FileResponse

from applytrack.core.config import Settings
from applytrack.storage import content_disposition
from applytrack.storage.local import LOCAL_STORAGE_PATH, LocalStorage

router = APIRouter(prefix=LOCAL_STORAGE_PATH, include_in_schema=False)


def _storage(request: Request) -> LocalStorage:
    storage: LocalStorage = request.app.state.storage
    return storage


def _cors(request: Request) -> dict[str, str]:
    settings: Settings = request.app.state.settings
    return {"Access-Control-Allow-Origin": settings.public_app_url, "Vary": "Origin"}


def _valid(request: Request, method: str, key: str, details: dict[str, str]) -> Path | None:
    storage = _storage(request)
    try:
        expires_at = int(request.query_params.get("expires", ""))
        signature = request.query_params.get("signature", "")
        if storage.verify(method, key, expires_at, details, signature):
            return storage.path(key)
    except ValueError:  # a bad number or key
        pass
    return None


@router.options("/{key:path}")
def preflight(request: Request) -> Response:
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers={
            **_cors(request),
            "Access-Control-Allow-Methods": "PUT",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Max-Age": "600",
        },
    )


@router.put("/{key:path}")
async def upload(key: str, request: Request) -> Response:
    content_type = request.query_params.get("type", "")
    size = request.query_params.get("size", "")
    path = _valid(request, "PUT", key, {"type": content_type, "size": size})
    if path is None or request.headers.get("content-type") != content_type:
        return Response(status_code=status.HTTP_403_FORBIDDEN, headers=_cors(request))
    body = await request.body()
    if str(len(body)) != size:
        return Response(status_code=status.HTTP_400_BAD_REQUEST, headers=_cors(request))
    _storage(request).write(key, body)
    return Response(status_code=status.HTTP_200_OK, headers=_cors(request))


@router.get("/{key:path}", response_model=None)
def download(key: str, request: Request) -> Response | FileResponse:
    filename = request.query_params.get("filename", "")
    path = _valid(request, "GET", key, {"filename": filename})
    if path is None or not path.is_file():
        return Response(status_code=status.HTTP_404_NOT_FOUND)
    return FileResponse(path, headers={"Content-Disposition": content_disposition(filename)})
