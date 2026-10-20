"""Route only the legacy client's service hosts; pass every CDN request upstream."""
import os
from urllib.parse import urlparse
from mitmproxy import http

LOCAL = {
    "privatefreefirebackend.vercel.app": ("backend-stack-live", 3000),
    "loginbp.samosasmobiles.dpdns.org": ("backend-stack-login", 3001),
    "loginbp2.samosasmobiles.dpdns.org": ("backend-stack-main", 3002),
}
AUTH_HOSTS = {
    "auth.samosasmobiles.dpdns.org",
    "g.samosasmobiles.dpdns.org",
    "100067.msdk.garena.com",
}
AUTH = urlparse(os.getenv("AUTH_ORIGIN", "https://free-fire-auth.vercel.app"))


def request(flow: http.HTTPFlow) -> None:
    original = flow.request.pretty_host.lower()
    local = LOCAL.get(original)
    if local:
        flow.request.scheme = "http"
        flow.request.host, flow.request.port = local
        flow.request.headers["x-forwarded-host"] = original
        flow.request.headers["x-backend-client"] = "1"
        return

    if original in AUTH_HOSTS:
        flow.request.scheme = AUTH.scheme
        flow.request.host = AUTH.hostname
        flow.request.port = AUTH.port or (443 if AUTH.scheme == "https" else 80)
        flow.request.headers["host"] = AUTH.hostname
        flow.request.headers["x-forwarded-host"] = original
        flow.request.headers["x-backend-client"] = "1"
