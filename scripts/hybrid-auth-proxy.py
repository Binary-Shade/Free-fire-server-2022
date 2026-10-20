"""Use our OAuth service while leaving the existing game stack upstream.

Only the legacy Garena SDK authentication hosts are rewritten. Version,
MajorLogin, GetLoginData, lobby, TCP, chat, and match traffic pass through to
their original destinations.
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from mitmproxy import ctx, http


AUTH_HOSTS = {
    "auth.samosasmobiles.dpdns.org",
    "g.samosasmobiles.dpdns.org",
    "100067.msdk.garena.com",
}
AUTH = urlparse(os.getenv("AUTH_ORIGIN", "https://free-fire-auth.vercel.app"))
EVENT_LOG = Path(os.getenv("HYBRID_AUTH_LOG", ".tmp/hybrid-auth-events.log"))


def _event(message: str) -> None:
    EVENT_LOG.parent.mkdir(parents=True, exist_ok=True)
    with EVENT_LOG.open("a", encoding="utf-8") as stream:
        stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        stream.write(f"{stamp} {message}\n")


def request(flow: http.HTTPFlow) -> None:
    original_host = flow.request.pretty_host.lower()
    flow.metadata["hybrid_original_host"] = original_host

    if original_host not in AUTH_HOSTS:
        return

    flow.metadata["hybrid_auth_redirect"] = True
    flow.request.scheme = AUTH.scheme
    flow.request.host = AUTH.hostname
    flow.request.port = AUTH.port or (443 if AUTH.scheme == "https" else 80)
    flow.request.headers["host"] = AUTH.hostname
    flow.request.headers["x-forwarded-host"] = original_host
    flow.request.headers["x-hybrid-auth-client"] = "1"
    message = f"AUTH -> {flow.request.method} {original_host}{flow.request.path}"
    _event(message)
    ctx.log.info(message)


def response(flow: http.HTTPFlow) -> None:
    original_host = flow.metadata.get("hybrid_original_host", "")
    if flow.metadata.get("hybrid_auth_redirect"):
        message = (
            f"AUTH <- {flow.response.status_code} {original_host}{flow.request.path}"
        )
        _event(message)
        ctx.log.info(message)
    elif original_host in {
        "privatefreefirebackend.vercel.app",
        "loginbp.samosasmobiles.dpdns.org",
        "loginbp2.samosasmobiles.dpdns.org",
    }:
        message = (
            f"GAME passthrough <- {flow.response.status_code} "
            f"{original_host}{flow.request.path}"
        )
        _event(message)
        ctx.log.info(message)
