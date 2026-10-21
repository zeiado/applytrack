"""Request context middleware: client IP, request id, access log, and a last-resort 500.

A plain ASGI middleware rather than Starlette's BaseHTTPMiddleware, which has known
problems with streaming responses and with context variables.
"""

import hmac
import ipaddress
import logging
import time
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from applytrack.core.client_ip import forwarded_for_entries, resolve_client_ip
from applytrack.core.errors import internal_error_response
from applytrack.core.logging import accept_request_id, request_id_var

REQUEST_ID_HEADER = "x-request-id"
FORWARDED_FOR_HEADER = b"x-forwarded-for"
# Sent by our own web server (see Settings.client_ip_secret).
CLIENT_IP_HEADER = b"x-client-ip"
PROXY_SECRET_HEADER = b"x-proxy-secret"
access_logger = logging.getLogger("applytrack.access")
error_logger = logging.getLogger("applytrack.errors")


class RequestContextMiddleware:
    def __init__(
        self, app: ASGIApp, *, trusted_proxy_hops: int = 0, client_ip_secret: str | None = None
    ) -> None:
        self.app = app
        self.trusted_proxy_hops = trusted_proxy_hops
        self.client_ip_secret = client_ip_secret.encode() if client_ip_secret else None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_headers = scope.get("headers") or []
        headers = dict(raw_headers)
        peer_host, peer_port = scope.get("client") or ("-", 0)
        forwarded_for = [v.decode("latin-1") for k, v in raw_headers if k == FORWARDED_FOR_HEADER]
        client_ip = resolve_client_ip(peer_host, forwarded_for, self.trusted_proxy_hops)
        client_ip = self._vouched_client_ip(headers) or client_ip
        # Everything downstream (request.client, the login rate limiter) sees the real client.
        scope = {**scope, "client": (client_ip, peer_port)}
        incoming = headers.get(REQUEST_ID_HEADER.encode(), b"").decode("latin-1") or None
        request_id = accept_request_id(incoming)
        token = request_id_var.set(request_id)
        if forwarded_for:  # at DEBUG, to measure how many proxies a host puts in front
            access_logger.debug(
                "X-Forwarded-For has %d entries", len(forwarded_for_entries(forwarded_for))
            )
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
                        "client": client_ip,
                    }
                },
            )
            request_id_var.reset(token)

    def _vouched_client_ip(self, headers: dict[bytes, bytes]) -> str | None:
        """The visitor's IP as reported by our web server, if the request proves it's
        from that server. Anyone else's X-Client-IP is ignored."""
        secret = headers.get(PROXY_SECRET_HEADER)
        if self.client_ip_secret is None or secret is None:
            return None
        if not hmac.compare_digest(secret, self.client_ip_secret):
            access_logger.warning("Wrong X-Proxy-Secret; ignoring X-Client-IP")
            return None
        try:
            return str(ipaddress.ip_address(headers.get(CLIENT_IP_HEADER, b"").decode("latin-1")))
        except ValueError:
            return None
