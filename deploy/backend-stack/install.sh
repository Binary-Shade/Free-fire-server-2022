#!/usr/bin/env bash
set -euo pipefail

archive="${1:-/root/backend-stack-deploy.tar.gz}"
target=/opt/backend-stack

mkdir -p "$target"
tar -xzf "$archive" -C "$target"
cd "$target/deploy/backend-stack"
mkdir -p proxy/ca
if [[ ! -f .env ]]; then
  umask 077
  secret="$(openssl rand -hex 48)"
  cat > .env <<EOF
PUBLIC_HOST=82.112.238.156
MATCH_JWT_SECRET=${secret}
AUTH_ORIGIN=https://free-fire-auth.vercel.app
EOF
fi
chmod 600 .env
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps

echo
echo "Proxy: 82.112.238.156:18080"
echo "Gateway TCP: 82.112.238.156:10300"
echo "Realtime UDP: 82.112.238.156:10100"
