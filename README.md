# Free-fire-server-2022

This repository implements the HTTP login/lobby tier, persistent TCP gateway,
matchmaking and settlement services for the 1.70 client, plus a Go UDP match
server focused on Clash Squad. It also contains the Facebook/Garena-shaped auth
API expected by the old Android SDK.

The auth tier now supports server-owned username/password accounts. Set
`AUTH_PROVIDER=local`; Discord is not required. The client-facing redirects and
protobuf protocol remain compatible with the analyzed build.

See [docs/protocol-analysis.md](docs/protocol-analysis.md) for the captured
network flow and emulator assessment, and [docs/local-auth.md](docs/local-auth.md)
for configuration, tests and security limitations.

## Quick validation

```powershell
cd auth
npm test
cd ..
npm audit --omit=dev
```

`scripts/local-protocol-smoke.js` exercises encrypted `MajorRegister`,
`MajorLogin`, the game Bearer token and authenticated `GetLoginData` against
running login and main services.

## Current scope

- HTTP login/lobby protocol: implemented
- Local or Discord-backed auth identity: implemented
- TCP notifications, rooms and matchmaking: implemented
- UDP match transport and core Clash Squad play: implemented in Go
- Every historical game mode and all original server behavior: not implemented

Use only client files and assets you are authorized to test. Start deployments
with a new database and secrets; the archived sample database is development
data.

Original emulator credits: foices and claudao.
