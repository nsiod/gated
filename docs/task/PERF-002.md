# PERF-002 sqlx Pool 生命周期管理

- **status**: completed
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## Outcome

- New `gated_core::db_pool_registry::DbPoolRegistry` owns the SQL
  Console sqlx pool cache. Keyed by `Target::id` (was `Target::name`
  in the old `Lazy<Mutex<HashMap<String, Pool>>>`, which stranded
  pools across renames).
- Each cached entry carries a connection-options fingerprint
  (host / port / credentials / database / TLS mode / read-only).
  `get_or_create` rebuilds and closes the old pool on mismatch, so
  target edits take effect without waiting for idle timeout.
- Explicit `invalidate(target_id)` / `invalidate_all()` hooks; called
  from `api_update_target` and `api_delete_target` in
  `gated-admin::api::targets`.
- Pool params: `max_connections=5`, `acquire_timeout=10s`,
  `idle_timeout=300s`, `max_lifetime=3600s` (new — prevents stale
  TCP sessions from lingering forever). Configurable pool params are
  deferred (would require a `parameters` migration; noted as
  follow-up).
- Metrics: `gated_db_pool_size{target}` / `gated_db_pool_idle{target}`
  set on every `get_or_create` call. Descriptions registered in
  `gated_core::metrics::describe_metrics`; entry added to
  `docs/ops/metrics.md`.

## Verification

- `cargo test -p gated-core db_pool_registry`: 3/3 pass
  (fingerprint invariants + `invalidate` no-op on missing id).
- `cargo check --all-features`: clean.
- `cargo cranky --all-features -p gated-core -p gated-admin`: clean
  (pre-existing `db_terminal.rs` warnings unchanged).

## Deferred

- Configurable pool params via `parameters` row / admin UI — needs a
  migration and an `/api/admin/parameters` schema bump.
- YAML config-reload event bus that touches the pool registry — the
  current reload path only affects auth/session state; target edits
  go through `/api/admin/targets` and already trigger invalidation.

## Description

`crates/gated-protocol-http/src/api/db_query.rs:49` 使用全局 `Lazy<Mutex<HashMap<TargetKey, Pool>>>` 缓存 per-target sqlx pool。当前实现存在问题：

- Target 配置变更（host/port/credential/readonly）后旧 pool 仍保留，直到进程重启。
- Target 删除后 pool 永不释放。
- `min_connections = 0` 但 `idle_timeout` 未设置，连接可能常驻。
- 没有 metrics 暴露 pool size / in-use。

验收标准：
- 把 pool registry 迁到 `gated-core` 的 `Services`（例如 `DbPoolRegistry`）。
- 订阅 config reload / target 删除事件，对应 `pool.close()`；若无现成事件，临时实现基于 `(target_id, config_version)` 的 key，过期则替换。
- 可配置 `min_connections` / `max_connections` / `idle_timeout` / `max_lifetime`；默认保守。
- 暴露 metrics（配合 OBS-001）：`gated_db_pool_size`, `gated_db_pool_idle`。

## ActiveForm

把 DB pool 注册表迁到 Services 并管理生命周期

## Dependencies

- **blocked by**: REFACTOR-001
- **blocks**: OBS-001

## Notes

考虑为 MySQL / Postgres 分别保留两个子 registry，或用 enum 承载。
