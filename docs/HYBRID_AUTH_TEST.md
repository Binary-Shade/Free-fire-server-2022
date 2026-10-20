# Hybrid authentication test

Test date: 2026-10-20

## Goal

Use the project authentication service for account registration and sign-in,
then leave the legacy version, game login, lobby, TCP, chat, and realtime match
services on the existing upstream stack.

## Client and routing

The test uses the stable Android build whose protected DEX and IL2CPP metadata
remain unchanged. Its network-security resource trusts the user-installed test
CA, and it is signed with the same public AOSP test certificate as the source
APK.

`scripts/hybrid-auth-proxy.py` redirects only these authentication hosts to
`https://free-fire-auth.vercel.app`:

- `auth.samosasmobiles.dpdns.org`
- `g.samosasmobiles.dpdns.org`
- `100067.msdk.garena.com`

The version host, `loginbp`, `loginbp2`, TCP, chat, and match traffic retain
their original destinations.

## Verified results

The hosted auth API passed its direct live test:

- login dialog: OK
- local account registration: OK
- pairing completion: OK
- token issue: OK
- token inspection: OK

The Android client then completed the same flow through the split proxy:

1. Upstream `/live/ver.php` returned HTTP 200.
2. Our `/v9.0/dialog/oauth` returned HTTP 200 and rendered the local login UI.
3. Our `/local/session` returned HTTP 200.
4. Our `/oauth/token/facebook/exchange` returned HTTP 200.
5. The client accepted the SDK token and closed the login WebView.
6. Upstream `/MajorLogin` returned HTTP 403 on every attempt.

The APK remained alive and showed the authenticated title state, but could not
enter the upstream lobby because the upstream login service does not recognize
tokens issued by this project.

## Architecture conclusion

Authentication and game login are separate trust boundaries:

```text
username/password
       |
       v
project auth -> access_token + open_id
       |
       v
legacy client -> MajorLogin -> game login service
                                  |
                                  v
                           game session/account
```

Our auth system proves ownership of an identity and issues an access token.
`MajorLogin` must validate that token and map its `open_id` to a game account.
The project login backend already performs that validation, which is why the
full project stack works. The upstream login backend has a different token
store or verification key, so it rejects the project token with HTTP 403.

No client-only APK change can make an independent server trust a new token
issuer. A complete hybrid requires one of these server-side integrations:

1. The game-login operator calls our `/oauth/token/inspect` endpoint and maps
   the returned `open_id`/UID to an account.
2. The operator configures a shared signing/verification key and accepts our
   token format.
3. The operator exposes a trusted token-exchange endpoint that validates our
   token and returns a game-login token.

Without cooperation from that server, the supported combinations are project
auth with the project backend, or the upstream auth with the upstream backend.

## Local test state

- Package: `com.dts.freefireth`
- Version: `1.70.0` (`2019114971`)
- OBB: `main.2019114971.com.dts.freefireth.obb`
- Proxy listener: localhost TCP `18081`
- Emulator route: `adb reverse tcp:18081 tcp:18081`
- Emulator HTTP proxy: `127.0.0.1:18081`
- Proxy event log: `.tmp/hybrid-auth-events.log`

The event log records methods, hosts, paths, and HTTP status codes only. It
does not record request bodies, passwords, or response tokens.
