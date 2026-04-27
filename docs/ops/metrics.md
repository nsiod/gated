# Prometheus Metrics

Gated exposes Prometheus metrics via the `metrics` crate plus the
`metrics-exporter-prometheus` backend. The exporter is **disabled by
default**; enable it with:

```yaml
metrics:
  enable: true
  listen: "127.0.0.1:9090"   # default
```

Gated then serves `GET /metrics` on that endpoint in Prometheus text
format. The listener is intentionally not behind the gateway's auth
stack — it is meant to be loopback- or private-network-bound and
scraped by a sidecar. Don't expose it on a public interface.

If `metrics.enable = false`, all instrumentation sites compile down to
no-ops via the `metrics` crate's global-recorder dispatch, so there is
zero runtime overhead.

## Catalog

All metric names are prefixed with `gated_`. The authoritative catalog
is below; add to this table whenever you introduce a new metric.

| Name | Type | Labels | Emitted at |
|------|------|--------|------------|
| `gated_sessions_active` | gauge | `protocol` | `gated_core::State::register_session` increments; `remove_session` decrements. `protocol` comes from the `ProtocolName` passed in at registration (`SSH`, `HTTP`, `MySql`, `Postgres`, `Kubernetes`, `DbQuery`, ...). |
| `gated_auth_attempts_total` | counter | `result`, `method` | HTTP login: `(result=accepted\|rejected, method=password)` on each `/auth/login`; OTP: `(result=accepted\|rejected, method=otp)` on each `/auth/otp`. |
| `gated_db_query_total` | counter | `target`, `result` | `crates/gated-protocol-http/src/api/db_query.rs::api_db_query`, after the backend returns: `result=ok` on `Ok(_)`, `result=error` on any backend error. |
| `gated_db_query_duration_seconds` | histogram | `target` | Same site; records `elapsed.as_secs_f64()` for every query, success or failure, after statement timeouts. |
| `gated_rate_limit_rejected_total` | counter | `endpoint` | `endpoint=sql_console` when `SqlConsoleRateLimiter::check` rejects in `db_query.rs`; `endpoint=db_terminal` when it rejects before a WebSocket terminal opens. |
| `gated_config_reload_total` | counter | — | `crates/gated/src/commands/run.rs::watch_config_and_reload`, every time the YAML file watcher fires a reload event. |
| `gated_db_pool_size` | gauge | `target` | `gated_core::db_pool_registry::DbPoolRegistry::get_or_create` emits the sqlx `Pool::size()` (idle + in-use connections) on every cache hit or miss. |
| `gated_db_pool_idle` | gauge | `target` | Same site as `gated_db_pool_size`; reports `Pool::num_idle()`. |

## Not yet covered (planned)

- Per-connection counters on the native MySQL / Postgres / SSH /
  Kubernetes wire-protocol proxies. The initial PR covers the HTTP
  gateway (where SQL Console lives); the wire-protocol crates can be
  instrumented in follow-up tickets without touching this module.

## Naming conventions

- Metric names: `gated_<subsystem>_<measurement>[_unit]`, lowercase,
  snake_case. Units follow Prometheus style (`_total` for counters,
  `_seconds` for durations, `_bytes` for sizes).
- Labels: lowercase snake_case. Cardinality should stay bounded —
  `target` is bounded by the admin-controlled target list, `protocol`
  and `method` are small enums. Don't label on user-supplied SQL,
  usernames, or IP addresses.
- Never put secret material in a label.

## Scraping

Prometheus scrape config example (sidecar):

```yaml
scrape_configs:
  - job_name: gated
    metrics_path: /metrics
    static_configs:
      - targets: ["127.0.0.1:9090"]
```

No TLS on the metrics listener by default. If you want to serve it on
a non-loopback interface, terminate TLS at a reverse proxy (e.g. the
same one that fronts `/admin/api`) rather than extending this listener
— it is intentionally minimal to avoid sharing rustls state with the
gateway's public TLS surface.
