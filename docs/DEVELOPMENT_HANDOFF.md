# Development handoff

This repository contains the source, deployment configuration, protocol definitions, migrations, dashboard, and reusable analysis needed to continue development on another computer.

## Current baseline

- Branch: `main`
- The server supports the HTTP services, TCP gateway and chat services, Redis-backed matchmaking, and the Go UDP match server.
- Network interruption and match reconnection recovery were added in commit `727dbd9`.
- Production deployment instructions are in [`deployment.md`](../deployment.md).
- The local launcher is [`start-local-server.ps1`](../start-local-server.ps1).

## Set up another development computer

1. Clone the repository and check out `main`.
2. Copy `.env.example` to `.env` and supply environment-specific values. Never commit `.env`.
3. Run `npm ci` in the repository root.
4. Run `npm ci` in `admin-ui`.
5. Install the Go version required by `match-server/go.mod`.
6. Start the local stack with `./start-local-server.ps1`, or follow `deployment.md` for a VPS.

Useful validation commands:

```powershell
npm run repo-smoke
npm run protocol-feature-smoke
npm run chat-integration-smoke
Push-Location match-server
go test ./...
Pop-Location
```

## Retained protocol research

Small, reusable findings are committed under `data`:

- `data/ALOK_SKILL_CAPTURE_REPORT.md`
- `data/training-capture/TRAINING_MATCH_ANALYSIS.md`
- `data/analysis/OBB_ANALYSIS.md`
- `data/analysis/OBB_SERVER_AUDIT.md`
- the command and resource catalogs in `data/analysis`

The IL2CPP bootstrap URL helper is `scripts/patch-il2cpp-bootstrap-url.ps1`.

## Files intentionally kept outside Git

APK/XAPK/OBB binaries, extracted application trees, packet captures, raw runtime logs, local databases, generated proxy certificates, and private keys are excluded. These files are large, reproducible, device-specific, or may contain session material. Working client binaries should be transferred through the private GitHub release assets rather than committed to Git history.

Before moving computers, separately retain any local `.env` values and device-specific signing material in a secure location. Do not copy generated proxy CA private keys unless the same installed CA must remain trusted on an existing test device.
