# Local authentication for the 1.70 client

This fork can use accounts stored entirely on the private server. Set
`AUTH_PROVIDER=local`; Discord is then neither configured nor contacted.

## What the client sees

The old client still uses its expected Facebook/Garena-shaped flow:

1. The SDK opens `/dialog/oauth` in its WebView.
2. The server displays the local username/password page.
3. `/local/session` creates or verifies the local identity.
4. The auth service issues random access and refresh tokens and returns an
   `fbconnect://success#...` redirect with the expected fields.
5. The client sends the resulting `open_id` and access token in its encrypted
   `MajorLogin` request.
6. `MajorLogin` issues a separate, short-lived game Bearer token.
7. The matchmaker later issues a third token: the short-lived HS256 match JWT
   accepted by the Go UDP server.

The compatibility surface stays the same; only the identity provider changes.

## Required production settings

Use one PostgreSQL database for the auth and game services. The auth tables use
the `auth` schema and the game tables use `public`.

```dotenv
AUTH_PROVIDER=local
APP_ID=100067
APP_SECRET=<long random value>
DATABASE_URL=postgres://ff:<password>@postgres:5432/freefire
AUTH_PG_SCHEMA=auth

AUTH_ENFORCE_REGISTRATION=true
AUTH_ENFORCE_LOGIN_TOKEN=true
AUTH_ALLOW_GUEST=false
AUTH_ENFORCE_BANS=true
GAME_TOKEN_TTL_SEC=28800

MATCH_JWT_SECRET=<a different long random value>
```

`APP_ID` must equal the application id expected by the patched client. The
analyzed 1.70 build uses `100067`. Generate fresh values for `APP_SECRET`, the
database password, and `MATCH_JWT_SECRET`; do not copy tokens or secrets from a
packet capture.

When `AUTH_ENFORCE_REGISTRATION` and `AUTH_ENFORCE_LOGIN_TOKEN` are enabled,
`MajorLogin` accepts only an `open_id` provisioned by this auth service and only
when the client presents its current auth access token. PostgreSQL is required
for these two gates in the current implementation.

## Password storage

Usernames are normalized to lowercase and limited to 3-32 letters, numbers,
dots, dashes, and underscores. Passwords are limited to 8-128 characters and
stored as salted 64-byte scrypt hashes. The database never stores plaintext
passwords.

PostgreSQL startup adds `local_username` and `password_hash` to `auth.guests`
idempotently. MongoDB deployments get a sparse unique `local_username` index.

## Services and routing

| Service | Default port | Client purpose |
|---|---:|---|
| Auth connect | 5000 | OAuth token inspection/refresh and Graph-compatible calls |
| Auth login | 25565 | WebView login page and local account submission |
| Live | 3000 | `/live/ver.php`; selects the game login service |
| Game login | 3001 | `MajorLogin`, registration, region selection |
| Game main | 3002 | `GetLoginData` and lobby/economy/profile APIs |
| TCP gateway | 10300 | Persistent notifications, rooms, matchmaking |
| UDP match | 10100 | Match transport; a fleet may allocate another port |

The analyzed APK currently contains third-party custom domains. To use this
backend independently, point its version URL and patched SDK authorities at
domains you control, serve them with valid TLS certificates, and configure the
public live/login/main/TCP/match hosts in `.env`. `GetLoginData` and matchmaking
then hand the client your own TCP and UDP addresses.

## Validation

From `auth/`:

```powershell
npm test
```

The tests cover username validation, salted password hashing, registration,
login rejection, token rotation, and construction of the client-compatible
`fbconnect://` redirect.

The repository's AES implementation was also tested against the captured
`MajorLogin` request from the analyzed APK. It decrypted the complete 992-byte
ciphertext with valid PKCS#7 padding and reproduced the ciphertext exactly when
re-encrypted. This confirms that the HTTP protocol implementation matches that
client build.

The end-to-end protocol smoke was run with the login and main processes started
at the same time against a new SQLite database:

```powershell
$env:DB_FILE = "$PWD/data/local-smoke.db"
$env:LOGIN_PORT = "3101"
$env:MAIN_PORT = "3102"
$env:SERVER_URL = "http://127.0.0.1:3102"
$env:REALTIME_HOST = "127.0.0.1"

# Run these in separate terminals:
node src/servers/login.js
node src/servers/main.js

# Then run in a third terminal with the same LOGIN_PORT and MAIN_PORT:
node scripts/local-protocol-smoke.js
```

The test requires an unknown login to return 404, registers it, obtains a game
Bearer token, loads the lobby with that token, and confirms an invalid token is
rejected. The SQLite startup migration is safe when both processes start on a
new database concurrently.

For a full deployment, copy `.env.example` to `.env`, replace every placeholder
secret and public host, then run `docker compose up --build`. The client must be
patched or DNS-routed so its version, auth, login and main endpoints resolve to
those hosts. Raw TCP and UDP endpoints also need direct, publicly reachable
ports; an HTTP reverse proxy cannot carry the UDP match stream.

## Security notes

- The game's AES key and IV are static client compatibility values. They provide
  framing/obfuscation, not authentication or secrecy against a modified client.
- Keep TLS enabled even though request bodies are AES wrapped.
- Keep registration and login-token enforcement enabled outside local testing.
- Rotate game Bearer tokens and match JWT secrets independently.
- Start with a fresh database. The archive includes a sample `data/accounts.db`;
  do not deploy that file as a production account store.
- The decrypted mitmproxy capture contains session tokens and must not be shared.
- Protocol request logging redacts login, access, refresh, game and match tokens.
