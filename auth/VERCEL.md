# Auth-only Vercel test

Set the Vercel project root directory to `auth`. The deployment serves the
legacy WebView login service and Garena-compatible connect/OAuth endpoints from
one serverless function.

## Required environment variables

```text
NODE_ENV=production
AUTH_PROVIDER=local
APP_ID=100067
APP_SECRET=<long-random-secret>
DATABASE_URL=<managed-postgres-connection-string>
AUTH_PG_SCHEMA=auth
TRUST_PROXY=true
```

Use a managed PostgreSQL provider such as Neon, Supabase, or Vercel Marketplace
Postgres. Do not use the temporary in-memory auth server or SQLite on Vercel.

For the first browser test, open `/dialog/oauth` using the same query parameters
captured from the APK. OAuth paths such as `/oauth/token/inspect` are dispatched
to the connect application automatically.

For the patched APK, attach two custom domains to the same deployment and add:

```text
AUTH_PUBLIC_HOST=auth.example.com
CONNECT_PUBLIC_HOST=connect.example.com
```

The hostname then selects the correct application while preserving the exact
paths expected by the old client SDK.

This deployment covers authentication only. The game HTTP API, TCP gateway,
Redis, matchmaking, and UDP match server still run on the PC or a VPS.
