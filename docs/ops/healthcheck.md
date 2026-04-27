# Healthchecks

Gated exposes three levels of health signal:

| Surface | Purpose | Cost |
|---------|---------|------|
| `gated healthcheck` (CLI, no flags) | Container-level liveness for Docker/compose. HTTPS GET `/api/info`. | One HTTP request. |
| `gated healthcheck --deep` (CLI) | Operator-level deep probe. Builds a full `Services` and prints a JSON report. Exits non-zero on `fail`. | Same as a normal startup — connects to the DB, runs pending migrations if any. |
| `/healthz` + `/readyz` (HTTP) | Kubernetes probe surface. Mounted on the metrics listener. | `/healthz` is a static 200. `/readyz` runs the deep-check sweep on the already-running process. |

## Deep-check report shape

```json
{
  "status": "ok",
  "generated_at": "2026-04-19T09:39:43.123Z",
  "checks": [
    { "name": "db.ping",          "status": "ok" },
    { "name": "db.migrations",    "status": "ok" },
    { "name": "db.tx_roundtrip",  "status": "ok" },
    { "name": "tls.cert",         "status": "ok", "message": "valid for 364 day(s)" }
  ]
}
```

Status rollup: any `fail` → overall `fail`; otherwise any `warn` → `warn`; else `ok`.

## Individual checks

| `name` | What it tests | `warn` / `fail` conditions |
|--------|---------------|---------------------------|
| `db.ping` | `SELECT 1` round-trip with a 3s timeout. | Fail: DB unreachable or query error. |
| `db.migrations` | `Migrator::get_pending_migrations` returns zero. | Fail: any pending migration or metadata query error. |
| `db.tx_roundtrip` | `BEGIN; COMMIT;` as a no-op transaction. Not a real write probe — verifies only that the connection can still speak the transaction protocol (useful for catching pool saturation, broken ACLs, or a dead server). | Fail: commit fails or times out. |
| `tls.cert` | Parses `http.certificate` PEM, reads the leaf's `not_after`. | Warn: cert expires in < 7 days. Fail: already expired, missing file, unreadable PEM, or empty `http.certificate`. |
| `ldap.reachability` (CLI only, unless `--skip-lookups`) | Placeholder — the LDAP bind probe is not yet implemented. | Always `warn` until implemented, so dashboards don't mistake "not implemented" for "healthy". |
| `sso.reachability` (CLI only, unless `--skip-lookups`) | Counts configured SSO providers. Discovery-URL probes are not yet implemented. | `ok` when zero providers are configured; `warn` otherwise until the probe is implemented. |

`/readyz` always passes `skip_lookups = true`, so the LDAP and SSO placeholders are omitted from the report it returns. They appear in `gated healthcheck --deep` output (unless you also pass `--skip-lookups` there).

## Kubernetes probe example

The `/healthz` / `/readyz` endpoints live on the metrics listener, so enable metrics even if you don't scrape them:

```yaml
# gated.yaml
metrics:
  enable: true
  listen: "127.0.0.1:9090"
```

Pod spec:

```yaml
containers:
  - name: gated
    image: ghcr.io/bkhq/gated:latest
    ports:
      - { name: https,   containerPort: 8888 }
      - { name: metrics, containerPort: 9090 }
    livenessProbe:
      httpGet:
        path: /healthz
        port: metrics
      initialDelaySeconds: 5
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /readyz
        port: metrics
      initialDelaySeconds: 10
      periodSeconds: 15
      timeoutSeconds: 5
```

`/readyz` responds `503` on overall `fail` so the pod is removed from the service endpoints while the underlying issue persists.

## Docker healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD /usr/local/bin/gated healthcheck || exit 1
```

Use the non-`--deep` form here — the deep variant opens a second DB connection and runs pending migrations, which is not something you want invoked every 30 seconds.

## Why not a separate health port

The OBS-001 metrics listener is already:

- loopback-bound by default,
- skipping the gateway's TLS stack,
- scoped to the same tokio runtime as the proxies.

Reusing it avoids a second `ListenEndpoint` config block, a second port in compose / k8s specs, and a second set of firewall rules. If you need liveness/readiness without metrics scraping, set `metrics.enable = true` but don't configure a Prometheus scrape — the three endpoints are independent.
