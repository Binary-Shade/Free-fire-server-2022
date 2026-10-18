# Protocol analysis of the 1.70 client and emulator

## Conclusion

`FreeFireServer-master` is not a generic proxy. It is a server emulator built
for the same protocol family used by the analyzed 1.70 Android client. The
strongest evidence is a captured `MajorLogin` request: this repository's static
AES-128-CBC key and IV decrypt all 992 bytes with valid PKCS#7 padding, and
encrypting the result reproduces the captured ciphertext byte for byte.

The archive is enough to replace the observed HTTP auth/login/lobby path and it
contains implementations for TCP matchmaking and a Go UDP Clash Squad server.
It is not the original Garena backend source and does not implement every old
game mode or every production behavior.

## Observed client path

The installed client contacted these services during the recorded session:

1. `privatefreefirebackend.vercel.app/live/ver.php` for version/bootstrap data.
2. `loginbp.samosasmobiles.dpdns.org/MajorLogin` for game login.
3. `loginbp2.samosasmobiles.dpdns.org/GetLoginData` for lobby and realtime
   addresses.
4. `137.59.53.150` over TCP ports 10200/10300 for persistent game traffic.
5. `137.59.53.150` over UDP port 10106 for the selected match instance.

Those addresses belong to the examined deployment. An independent deployment
must make the client use domains and addresses controlled by its operator.

## Protocol layers

### SDK-shaped identity flow

The client embeds an older login SDK and expects Facebook/Garena-shaped dialog,
token and graph endpoints. The source originally used Discord as an upstream
identity provider, then generated its own `open_id`, access token and refresh
token. Discord was not part of the game protocol; it was only a way to identify
a person.

The local-auth implementation preserves the SDK response and redirect shapes
while replacing Discord with a username and scrypt-hashed password.

### HTTP game protocol

Requests are protobuf messages encrypted with a static AES-128-CBC key and IV.
Responses are protobuf messages. The static client key is protocol
compatibility, not a security boundary: anyone controlling a client can extract
it. Authentication must come from server-validated tokens and TLS.

The main sequence is:

```text
SDK login -> open_id + auth access token
          -> MajorLogin
          <- short-lived game Bearer token + main URL
          -> GetLoginData (Authorization: Bearer ...)
          <- TCP gateway + match node addresses
```

The emulator's endpoint map and `.proto` files define the remaining lobby API.
Handlers are loaded from `src/handlers`; unknown or unfinished endpoints usually
return a default protobuf response so the client does not crash.

### Realtime and match traffic

After `GetLoginData`, the client opens the advertised TCP notification channel.
The gateway handles presence, room events and matchmaking. The matchmaker issues
a separate short-lived HS256 match JWT. The Go server validates that JWT when
the player joins the UDP match transport.

The three credential classes are deliberately separate:

| Credential | Issuer | Purpose |
|---|---|---|
| Auth access/refresh token | Auth service | Establish SDK identity and refresh login |
| Game Bearer token | `MajorLogin` | Authorize lobby HTTP endpoints |
| Match JWT | Matchmaker | Join one allocated UDP match instance |

## Changes made for an independent backend

- Added local username/password registration and login without Discord.
- Added PostgreSQL and MongoDB fields/indexes for local identities.
- Kept the exact `fbconnect://success` handoff expected by the client.
- Added auth-store enforcement switches for `open_id` and auth access tokens.
- Restricted public game routes to the explicit login/handshake allowlist.
- Added an eight-hour configurable expiry to game Bearer tokens.
- Redacted reusable tokens from decoded protocol logs.
- Fixed concurrent SQLite first-start migrations.
- Updated vulnerable production dependencies to audited versions.
- Added auth tests and an encrypted HTTP protocol smoke test.

## What remains before a real client can use this deployment

1. Point the client's version, SDK auth, login and main authorities at the new
   deployment. This requires an authorized client patch or controlled DNS.
2. Configure public domains and direct TCP/UDP addresses in `.env`.
3. Use PostgreSQL and enable registration and login-token enforcement.
4. Set unique application and match secrets and valid TLS certificates.
5. Build and run the Go match server, then test TCP matchmaking and UDP play
   with two isolated test accounts.
6. Implement any game mode or endpoint the client reaches that is currently a
   stub. The supplied match server is primarily Clash Squad.

The HTTP path is verified locally. Full Docker/PostgreSQL/Redis/Go gameplay was
not executed on this workstation because Docker and Go are not installed.
