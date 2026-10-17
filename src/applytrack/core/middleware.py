"""Request context middleware: request id, access log, and a last-resort 500.

A plain ASGI middleware rather than Starlette's BaseHTTPMiddleware, which has known
problems with streaming responses and with context variables.
"""

import logging
import time
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from applytrack.core.errors import internal_error_response
from applytrack.core.logging import accept_request_id, request_id_var

REQUEST_ID_HEADER = "x-request-id"
access_logger = logging.getLogger("applytrack.access")
error_logger = logging.getLogger("applytrack.errors")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        incoming = headers.get(REQUEST_ID_HEADER.encode(), b"").decode("latin-1") or None
        request_id = accept_request_id(incoming)
        token = request_id_var.set(request_id)
        start = time.perf_counter()
        response: dict[str, Any] = {"status": 500, "started": False}

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                response["status"] = message["status"]
                response["started"] = True
                message.setdefault("headers", [])
                message["headers"] = [
                    *message["headers"],
                    (REQUEST_ID_HEADER.encode(), request_id.encode()),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            # Log the full stack trace, but never send internals to the client.
            error_logger.exception("Unhandled error on %s %s", scope["method"], scope["path"])
            if response["started"]:
                # Too late for a clean 500 (e.g. mid-stream): the server closes the connection.
                raise
            await internal_error_response()(scope, receive, send_with_id)
        finally:
            status = response["status"]
            access_logger.log(
                logging.ERROR if status >= 500 else logging.INFO,
                "%s %s %s",
                scope["method"],
                scope["path"],
                status,
                extra={
                    "http": {
                        "method": scope["method"],
                        "path": scope["path"],  # no query string: it can hold personal data
                        "status": status,
                        "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                        "client": (scope.get("client") or ("-",))[0],
                    }
                },
            )
            request_id_var.reset(token)
