# backend-stack VPS deployment

The deployment uses its own Docker network, Redis instance, named data volumes,
and free host ports. Existing VPS projects are not restarted or modified.

Public client ports:

- `18080/tcp`: client HTTP/HTTPS proxy
- `10300/tcp`: persistent gateway
- `10100/udp`: realtime match service

The HTTP services are bound only to loopback on `3100`, `3101`, and `3102`.
The proxy routes the three known game hosts to those services and forwards the
known authentication hosts to the separately hosted HTTPS authentication app.
The installer generates the match signing secret on the VPS. Proxy CA private
keys are intentionally excluded from the source archive.

Install from the uploaded archive:

```bash
bash /opt/backend-stack/deploy/backend-stack/install.sh /root/backend-stack-deploy.tar.gz
```

Useful commands:

```bash
cd /opt/backend-stack/deploy/backend-stack
docker compose ps
docker compose logs -f --tail=100
docker compose restart backend-stack-proxy
```
