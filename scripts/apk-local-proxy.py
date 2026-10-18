"""Route the analyzed 1.70 APK's HTTPS hosts to local emulator services.

Run with:
  mitmdump -s scripts/apk-local-proxy.py -p 8080 -w data/apk-local-test.mitm

The Android guest must trust mitmproxy's CA. Unlisted hosts pass through to
their normal upstream servers, which keeps CDN requests working during the
local HTTP protocol test.
"""

from mitmproxy import http


ROUTES = {
    "privatefreefirebackend.vercel.app": 3000,
    "loginbp.samosasmobiles.dpdns.org": 3001,
    "loginbp2.samosasmobiles.dpdns.org": 3002,
    "auth.samosasmobiles.dpdns.org": 25565,
    "g.samosasmobiles.dpdns.org": 5000,
    "100067.msdk.garena.com": 5000,
}


def request(flow: http.HTTPFlow) -> None:
    original_host = flow.request.pretty_host.lower()
    port = ROUTES.get(original_host)
    if port is None:
        return

    flow.metadata["local_backend_original_host"] = original_host
    flow.request.scheme = "http"
    flow.request.host = "127.0.0.1"
    flow.request.port = port
    flow.request.headers["x-forwarded-host"] = original_host
    flow.request.headers["x-local-apk-test"] = "1"


def response(flow: http.HTTPFlow) -> None:
    original_host = flow.metadata.get("local_backend_original_host")
    if original_host:
        flow.response.headers["x-local-backend"] = original_host
