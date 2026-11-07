# VPS deployment

This guide deploys the server stack on an Ubuntu VPS for clients that are authorised to use your own server and client configuration. It uses normal DNS and publicly trusted TLS certificates. It does not copy or impersonate a third-party service, reuse another project's hostnames, or install a private CA on players' phones.

The repository contains two deployment layouts:

- `docker-compose.yml` is the full stack with Traefik, Postgres, Redis, the Node services, auth services, and a Go match instance.
- `deploy/backend-stack/compose.yaml` is the smaller isolated bundle used for a single VPS. It includes a compatibility proxy intended for controlled testing. Do not expose that proxy as a public client endpoint unless every client is an authorised test client and you understand its certificate requirements.

The rest of this document uses the full stack. The examples use DuckDNS names such as `mygame-live.duckdns.org`; replace them with names you own.

## 1. Public topology

Use separate hostnames so each client-facing role can be changed independently:

| Hostname | Transport | Purpose |
| --- | --- | --- |
| `mygame-live.duckdns.org` | HTTPS, 443 | lobby and content HTTP API |
| `mygame-login.duckdns.org` | HTTPS, 443 | game login HTTP API |
| `mygame-main.duckdns.org` | HTTPS, 443 | profile, inventory, room and social HTTP API |
| `mygame-auth-connect.duckdns.org` | HTTPS, 443 | account SDK/token API |
| `mygame-auth-login.duckdns.org` | HTTPS, 443 | your browser login service |
| `mygame-rt.duckdns.org` | TCP 10300, TCP 10200, UDP 10100 | gateway, chat, and realtime match services |

The HTTPS names must be configured in the client you are authorised to distribute. A DNS record alone does not redirect a hard-coded client to your server. Do not point official Garena/Barbosa hostnames at this VPS.

The gateway and match services are not ordinary HTTPS traffic. Do not put them behind a normal HTTP reverse proxy. Publish their TCP/UDP ports directly and restrict them with firewall rules where possible.

## 2. VPS requirements

For a small test deployment, use Ubuntu 22.04/24.04, two or more vCPUs, 4 GB RAM, 40 GB SSD, a static public IPv4 address, and Docker Engine with the Compose plugin. For public matches, allocate more CPU and RAM according to concurrent matches. Keep existing applications on the VPS isolated; do not reuse their containers, databases, volumes, or Nginx server blocks.

Create a non-root deployment user and keep SSH key authentication enabled:

```bash
sudo adduser --disabled-password --gecos '' gamesvc
sudo usermod -aG docker gamesvc
sudo install -d -o gamesvc -g gamesvc /opt/game-server
```

Log in as `gamesvc` for deployment. Use `sudo` only for package, firewall, and service operations.

## 3. DuckDNS and DNS

DuckDNS provides free subdomains under `duckdns.org`. Create the names in the DuckDNS dashboard and keep the account token private. DuckDNS documents the HTTPS update API at <https://www.duckdns.org/spec.jsp>.

Create these subdomains and point them to the VPS IPv4 address:

```text
mygame-live        A       VPS_IPV4
mygame-login       A       VPS_IPV4
mygame-main        A       VPS_IPV4
mygame-auth-connect A      VPS_IPV4
mygame-auth-login  A      VPS_IPV4
mygame-rt          A       VPS_IPV4
```

All six names can share the same VPS address. The gateway, chat, and match services are distinguished by port, not by DNS name. DuckDNS is only DNS; it does not provide HTTPS termination, DDoS protection, or a TCP/UDP relay.

Install a small updater on the VPS. A static VPS address normally does not change, but the updater is harmless and protects against address changes:

```bash
sudo install -d -m 700 /etc/duckdns
sudo install -m 600 /dev/null /etc/duckdns/update.sh
sudo nano /etc/duckdns/update.sh
```

Put this in the file, replacing the placeholders with your DuckDNS token and names:

```bash
#!/usr/bin/env bash
set -euo pipefail
TOKEN='DUCKDNS_TOKEN'
DOMAINS='mygame-live,mygame-login,mygame-main,mygame-auth-connect,mygame-auth-login,mygame-rt'
curl --fail --silent --show-error \
  "https://www.duckdns.org/update?domains=${DOMAINS}&token=${TOKEN}&verbose=true"
```

Then run it every five minutes with a systemd timer or cron. A cron entry is sufficient for a single VPS:

```bash
sudo chmod 700 /etc/duckdns/update.sh
sudo /etc/duckdns/update.sh
sudo crontab -e
```

Add:

```cron
*/5 * * * * /etc/duckdns/update.sh >/var/log/duckdns-update.log 2>&1
```

Verify propagation before requesting certificates:

```bash
for h in mygame-live mygame-login mygame-main mygame-auth-connect mygame-auth-login mygame-rt; do
  dig +short "$h.duckdns.org"
done
```

## 4. Install the host prerequisites

The following assumes Ubuntu and an empty set of ports 80, 443, 10100, 10200, and 10300. Check first because this VPS may already run unrelated projects:

```bash
sudo ss -ltnup
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

Install Docker from the official Docker instructions for your Ubuntu release, then confirm the Compose plugin:

```bash
docker version
docker compose version
```

Do not stop an existing service just to free a port. Choose unused ports and update every matching value in `.env`, Compose, DNS, and the client configuration, or place this stack on a separate VPS.

## 5. Upload and prepare the repository

From the development machine, upload a clean checkout. Do not upload `.env`, databases, APKs, proxy CA private keys, or build archives:

```bash
git archive --format=tar.gz --output=game-server.tar.gz HEAD
scp game-server.tar.gz gamesvc@VPS_IPV4:/tmp/
```

On the VPS:

```bash
sudo -u gamesvc tar -xzf /tmp/game-server.tar.gz -C /opt/game-server
cd /opt/game-server
cp .env.example .env
chmod 600 .env
```

Generate secrets instead of using the development values:

```bash
openssl rand -hex 48
openssl rand -hex 32
```

Keep the generated values in a password manager. `MATCH_JWT_SECRET` must be identical in the Node services and Go match service.

## 6. Production environment

Edit `.env` and set the domain values. The following is a starting point; retain any additional settings already present in `.env.example`:

```dotenv
NODE_ENV=production
DEFAULT_REGION=IND
LOBBY_REGION=IND

LIVE_DOMAIN=mygame-live.duckdns.org
LOGIN_DOMAIN=mygame-login.duckdns.org
MAIN_DOMAIN=mygame-main.duckdns.org
AUTH_CONNECT_DOMAIN=mygame-auth-connect.duckdns.org
AUTH_LOGIN_DOMAIN=mygame-auth-login.duckdns.org
TCP_PUBLIC_HOST=mygame-rt.duckdns.org
CHAT_PUBLIC_HOST=mygame-rt.duckdns.org
MATCH_PUBLIC_HOST=mygame-rt.duckdns.org
MATCH_ADVERTISE=mygame-rt.duckdns.org:10100
SERVER_URL=https://mygame-live.duckdns.org

GAME_SERVER_PORT=10100
CHAT_PORT=10200
TCP_PORT=10300
MATCH_JWT_SECRET=GENERATED_LONG_SECRET
MATCH_JWT_TTL_SEC=600

POSTGRES_USER=gameapp
POSTGRES_PASSWORD=GENERATED_DATABASE_PASSWORD
POSTGRES_DB=gameapp
DATABASE_URL=postgres://gameapp:GENERATED_DATABASE_PASSWORD@postgres:5432/gameapp?sslmode=disable

AUTH_PROVIDER=local
APP_ID=your-own-app-id
APP_SECRET=GENERATED_AUTH_SECRET
OAUTH_STATE_SECRET=GENERATED_OAUTH_SECRET
AUTH_ENFORCE_BANS=true
AUTH_ALLOW_GUEST=false
AUTH_ENFORCE_REGISTRATION=true
AUTH_ENFORCE_LOGIN_TOKEN=true
```

Do not use the sample development secrets or a guest account in production. Do not commit this file.

The auth service and game services must use the same Postgres instance when registration and login enforcement are enabled. Run migrations using the repository's documented migration command before enabling those gates.

## 7. TLS and Android compatibility

Android does not reject HTTP simply because it is Android; it rejects cleartext traffic when the application policy disallows it, and it rejects certificates that are not trusted by the device/application. Use HTTPS for all HTTP API hostnames and a certificate issued for the exact names above. Never distribute a mitmproxy CA to normal players.

There are two supported TLS approaches:

1. Let Traefik obtain certificates with ACME. This requires ports 80 and 443 to reach Traefik and valid DNS records. Configure an ACME email and enable the HTTPS entrypoint in the production Compose file.
2. Terminate TLS in an existing Nginx/Caddy instance and proxy only HTTPS traffic to the internal live/login/main/auth ports. Keep the raw gateway, chat, and match ports outside the HTTP proxy.

For a fresh VPS, the first approach is simplest. Before enabling it, change the Traefik entrypoint from HTTP-only to HTTPS and add an ACME resolver backed by a persistent volume. Use the official Traefik ACME documentation for the exact version in use. If using Nginx instead, Certbot documents the Nginx workflow at <https://certbot.eff.org/> and Let's Encrypt explains ACME certificate issuance at <https://letsencrypt.org/how-it-works/>.

The checked-in Compose file currently declares the HTTP entrypoint only, so treat that file as a development baseline. A production Traefik change must do all of the following together:

- add `--entrypoints.websecure.address=:443` and publish `443:443`;
- configure an ACME resolver and persist its `acme.json` file on a protected volume;
- change the live, login, main, and auth router labels to `entrypoints=websecure`, `tls=true`, and the ACME resolver;
- keep the TCP gateway on its own entrypoint and keep the UDP match port direct;
- optionally redirect port 80 to HTTPS after certificate issuance.

Do not put `tls=true` on the raw gateway router: that channel is application-encrypted TCP, not TLS.

For DuckDNS, an HTTP-01 certificate request requires every name to resolve to the VPS and port 80 to reach the ACME edge. Request one certificate containing the five HTTPS names, or separate certificates if your edge configuration is simpler. DNS-01 is also possible, but it requires securely wiring the DuckDNS token into the ACME client; never put that token in a client APK or public repository.

After TLS is active, verify each HTTP endpoint:

```bash
for h in mygame-live mygame-login mygame-main mygame-auth-connect mygame-auth-login; do
  curl --fail --silent --show-error --head "https://$h.duckdns.org/health"
done
```

If a health route is not defined for a service, use its documented status route or inspect its container log; do not treat a generic 404 as a TLS failure.

## 8. Firewall

Open only the ports required by this stack. Preserve SSH access from your trusted source before enabling UFW:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from YOUR_ADMIN_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 10100/udp
sudo ufw allow 10200/tcp
sudo ufw allow 10300/tcp
sudo ufw enable
sudo ufw status verbose
```

Do not expose Postgres, Redis, MongoDB, or internal Node ports. Compose keeps those services on the private Docker network; leave them there.

## 9. Start and verify

From the repository root:

```bash
docker compose config --quiet
docker compose pull
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 traefik login main gateway match
```

The match server must advertise the same public host and UDP port that the login/matchmaker response gives the client. A mismatch produces a successful lobby login followed by a failed match connection.

Check listeners and external reachability from another machine:

```bash
sudo ss -ltnup | grep -E ':(80|443|10100|10200|10300)'
nc -vz mygame-rt.duckdns.org 10300
nc -vz mygame-rt.duckdns.org 10200
```

UDP cannot be validated with `nc -vz` reliably; use the match server log and a real authorised client connection. Confirm that `MATCH_ADVERTISE` is a public DNS name, not `127.0.0.1` or a Docker service name.

## 10. Backups and upgrades

Back up Postgres and the named Redis volume before upgrades. For a small deployment:

```bash
mkdir -p /opt/backups/game-server
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > /opt/backups/game-server/postgres-$(date +%F).sql.gz
docker compose exec -T redis redis-cli BGSAVE
```

Keep at least one tested restore copy off the VPS. Upgrade with a drain window so no new matches form while the match service is replaced:

```bash
docker compose stop matchmaker
sleep 90
docker compose pull
docker compose up -d --build
docker compose ps
```

Do not delete volumes during an upgrade. `docker compose down -v` destroys persistent data and is never a routine deployment command.

## 11. Monitoring and troubleshooting

Useful commands:

```bash
docker compose ps
docker compose logs -f --tail=200 login main gateway match matchmaker
docker stats
df -h
free -h
```

Common symptoms:

- TLS works in a browser but the client cannot log in: verify the client uses your exact HTTPS hostnames and that the certificate chain is complete.
- Login succeeds but the lobby is empty: check `LIVE_DOMAIN`, `MAIN_DOMAIN`, database migrations, and the `GetLoginData` response.
- Matchmaking succeeds but the match never loads: check UDP 10100, `MATCH_ADVERTISE`, the JWT secret, and the match-server log.
- Chat is missing: check TCP 10200, `CHAT_PUBLIC_HOST`, and the chat service log.
- Android reports a certificate error: replace the certificate with one issued by a public CA for your domain. Do not install a proxy CA as a production workaround.

## 12. Important scope and security notes

This server implements a limited, independently operated protocol and game flow. It is not the official Garena service and does not implement every historical mode. Keep unfinished modes disabled until their complete server lifecycle is implemented and tested.

Use only game clients, assets, protocol data, and domains for which you have permission. Do not distribute modified copies of a commercial client, collect third-party credentials, or redirect official service names. Use your own account system, rotate secrets, rate-limit login, and publish a privacy policy before accepting other players.
