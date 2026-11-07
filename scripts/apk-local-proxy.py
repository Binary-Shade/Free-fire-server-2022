"""Route the analyzed 1.70 APK's HTTPS hosts to local emulator services.

Run with:
  mitmdump -s scripts/apk-local-proxy.py -p 8080 -w data/apk-local-test.mitm

The Android guest must trust mitmproxy's CA. Unlisted hosts pass through to
their normal upstream servers, which keeps CDN requests working during the
local HTTP protocol test.
"""

from mitmproxy import ctx, http


ROUTES = {
    "10.0.2.2": 25565,
    "privatefreefirebackend.vercel.app": 3000,
    "loginbp.samosasmobiles.dpdns.org": 3001,
    "loginbp2.samosasmobiles.dpdns.org": 3002,
    "auth.samosasmobiles.dpdns.org": 25565,
    "g.samosasmobiles.dpdns.org": 5000,
    "100067.msdk.garena.com": 5000,
    # The signed 1.71 client still constructs its embedded Facebook OAuth
    # dialog with these legacy hosts.
    "www.facebook.com": 25565,
    "m.facebook.com": 25565,
    # Barbosa 1.71 wrapper equivalents. Keep version/client/game hosts
    # upstream; only its WebView login and GOP/OAuth validation use local
    # services.
    "login.barbosasmobile.com": 25565,
    "graph.barbosasmobile.com": 5000,
    "connect.barbosasmobile.com": 5000,
    # Barbosa's Unity layer uses these equivalents after the WebView OAuth
    # handoff. They correspond to this project's live/version and login APIs.
    "versionsc.barbosasmobile.com": 3000,
    "client.barbosasmobile.com": 3001,
}


def request(flow: http.HTTPFlow) -> None:
    # `pretty_host` can retain the explicit port for IP-literal proxy
    # requests on some mitmproxy versions. `host` is the normalized host.
    original_host = flow.request.host.lower().strip("[]")
    # Android WebView bypasses the global proxy for loopback, but the
    # Facebook SDK's HttpURLConnection does not. Preserve our explicit local
    # auth/graph destination ports when those requests arrive via mitmproxy.
    if original_host in {"127.0.0.1", "localhost"} and flow.request.port in {25565, 5000}:
        port = flow.request.port
    else:
        port = ROUTES.get(original_host)
    if port is None:
        return

    ctx.log.info(
        f"local route {original_host}:{flow.request.port} "
        f"{flow.request.path} -> 127.0.0.1:{port}"
    )

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
