//! Per-target sqlx connection pool registry.
//!
//! Moved out of `crates/gated-protocol-http/src/api/db_query.rs` so that
//! pool lifecycle tracks config changes instead of leaking until process
//! restart.
//!
//! - Keyed by `Target::id` (UUID). The previous implementation keyed by
//!   `Target::name`, which meant renaming a target silently stranded the
//!   old pool.
//! - Each cached pool carries a *fingerprint* of the connection-relevant
//!   option subset (host / port / credentials / database / TLS mode /
//!   read-only flag). A `get_or_create` call with a mismatching
//!   fingerprint closes the old pool before building a new one — this is
//!   how target edits propagate without an explicit invalidate.
//! - Admin endpoints that mutate targets call [`invalidate`] on update
//!   and delete to close pools promptly rather than waiting for the next
//!   `get_or_create`.
//! - On every cache hit or miss the registry emits
//!   `gated_db_pool_size` and `gated_db_pool_idle` gauges (labelled by
//!   target name) so ops dashboards can watch saturation per-target.

use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Arc;
use std::time::Duration;

use gated_common::{Target, TargetOptions};
use sqlx::mysql::{MySqlConnectOptions, MySqlPool, MySqlPoolOptions};
use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions};
use tokio::sync::Mutex;
use uuid::Uuid;

const POOL_MAX_CONNECTIONS: u32 = 5;
const POOL_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(10);
const POOL_IDLE_TIMEOUT: Duration = Duration::from_secs(300);
const POOL_MAX_LIFETIME: Duration = Duration::from_secs(3600);

#[derive(Clone)]
pub enum TargetPool {
    MySql(MySqlPool),
    Postgres(PgPool),
}

impl TargetPool {
    fn size(&self) -> u32 {
        match self {
            Self::MySql(p) => p.size(),
            Self::Postgres(p) => p.size(),
        }
    }

    fn num_idle(&self) -> usize {
        match self {
            Self::MySql(p) => p.num_idle(),
            Self::Postgres(p) => p.num_idle(),
        }
    }

    async fn close(self) {
        match self {
            Self::MySql(p) => p.close().await,
            Self::Postgres(p) => p.close().await,
        }
    }
}

struct CachedPool {
    fingerprint: u64,
    target_name: String,
    pool: TargetPool,
}

/// Per-target sqlx pool cache. Registered on [`crate::Services`] and
/// shared by SQL Console handlers.
pub struct DbPoolRegistry {
    pools: Mutex<HashMap<Uuid, CachedPool>>,
}

impl DbPoolRegistry {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            pools: Mutex::new(HashMap::new()),
        })
    }

    /// Returns a cached pool, or builds one on miss / fingerprint
    /// mismatch. The old pool (if any) is closed before the new one is
    /// inserted.
    pub async fn get_or_create(&self, target: &Target) -> Result<TargetPool, String> {
        let fingerprint = compute_fingerprint(target);

        {
            let pools = self.pools.lock().await;
            if let Some(existing) = pools.get(&target.id) {
                if existing.fingerprint == fingerprint {
                    record_pool_metrics(&existing.target_name, &existing.pool);
                    return Ok(existing.pool.clone());
                }
            }
        }

        let pool = build_pool(target).await?;

        let mut pools = self.pools.lock().await;
        if let Some(prev) = pools.insert(
            target.id,
            CachedPool {
                fingerprint,
                target_name: target.name.clone(),
                pool: pool.clone(),
            },
        ) {
            tokio::spawn(async move {
                prev.pool.close().await;
            });
        }
        record_pool_metrics(&target.name, &pool);
        Ok(pool)
    }

    /// Close and drop the pool for `target_id` if one is cached. No-op
    /// when the target has no cached pool.
    pub async fn invalidate(&self, target_id: Uuid) {
        let removed = {
            let mut pools = self.pools.lock().await;
            pools.remove(&target_id)
        };
        if let Some(entry) = removed {
            entry.pool.close().await;
        }
    }

    /// Drop every cached pool (used for bulk config reloads / tests).
    pub async fn invalidate_all(&self) {
        let drained: Vec<CachedPool> = {
            let mut pools = self.pools.lock().await;
            pools.drain().map(|(_, v)| v).collect()
        };
        for entry in drained {
            entry.pool.close().await;
        }
    }
}

fn compute_fingerprint(target: &Target) -> u64 {
    let mut hasher = DefaultHasher::new();
    match &target.options {
        TargetOptions::MySql(o) => {
            "mysql".hash(&mut hasher);
            o.host.hash(&mut hasher);
            o.port.hash(&mut hasher);
            o.username.hash(&mut hasher);
            o.password.hash(&mut hasher);
            o.default_database_name.hash(&mut hasher);
            std::mem::discriminant(&o.tls.mode).hash(&mut hasher);
            o.readonly.hash(&mut hasher);
        }
        TargetOptions::Postgres(o) => {
            "postgres".hash(&mut hasher);
            o.host.hash(&mut hasher);
            o.port.hash(&mut hasher);
            o.username.hash(&mut hasher);
            o.password.hash(&mut hasher);
            o.default_database_name.hash(&mut hasher);
            std::mem::discriminant(&o.tls.mode).hash(&mut hasher);
            o.readonly.hash(&mut hasher);
        }
        other => {
            // Hash the discriminant name so non-DB kinds land on a
            // distinct key even if someone mistakenly asks for them.
            std::mem::discriminant(other).hash(&mut hasher);
        }
    }
    hasher.finish()
}

async fn build_pool(target: &Target) -> Result<TargetPool, String> {
    match &target.options {
        TargetOptions::MySql(opts) => {
            let mut cfg = MySqlConnectOptions::new()
                .host(&opts.host)
                .port(opts.port)
                .username(&opts.username);
            if let Some(pw) = opts.password.as_deref() {
                cfg = cfg.password(pw);
            }
            if let Some(db) = opts
                .default_database_name
                .as_deref()
                .filter(|s| !s.is_empty())
            {
                cfg = cfg.database(db);
            }
            cfg = cfg.ssl_mode(match opts.tls.mode {
                gated_tls::TlsMode::Required => sqlx::mysql::MySqlSslMode::Required,
                gated_tls::TlsMode::Preferred => sqlx::mysql::MySqlSslMode::Preferred,
                gated_tls::TlsMode::Disabled => sqlx::mysql::MySqlSslMode::Disabled,
            });
            let pool = MySqlPoolOptions::new()
                .max_connections(POOL_MAX_CONNECTIONS)
                .acquire_timeout(POOL_ACQUIRE_TIMEOUT)
                .idle_timeout(Some(POOL_IDLE_TIMEOUT))
                .max_lifetime(Some(POOL_MAX_LIFETIME))
                .connect_with(cfg)
                .await
                .map_err(|e| format!("MySQL connect failed: {e}"))?;
            Ok(TargetPool::MySql(pool))
        }
        TargetOptions::Postgres(opts) => {
            let mut cfg = PgConnectOptions::new()
                .host(&opts.host)
                .port(opts.port)
                .username(&opts.username);
            if let Some(pw) = opts.password.as_deref() {
                cfg = cfg.password(pw);
            }
            if let Some(db) = opts
                .default_database_name
                .as_deref()
                .filter(|s| !s.is_empty())
            {
                cfg = cfg.database(db);
            }
            cfg = cfg.ssl_mode(match opts.tls.mode {
                gated_tls::TlsMode::Required => sqlx::postgres::PgSslMode::Require,
                gated_tls::TlsMode::Preferred => sqlx::postgres::PgSslMode::Prefer,
                gated_tls::TlsMode::Disabled => sqlx::postgres::PgSslMode::Disable,
            });
            let pool = PgPoolOptions::new()
                .max_connections(POOL_MAX_CONNECTIONS)
                .acquire_timeout(POOL_ACQUIRE_TIMEOUT)
                .idle_timeout(Some(POOL_IDLE_TIMEOUT))
                .max_lifetime(Some(POOL_MAX_LIFETIME))
                .connect_with(cfg)
                .await
                .map_err(|e| format!("Postgres connect failed: {e}"))?;
            Ok(TargetPool::Postgres(pool))
        }
        _ => Err("Target is not MySQL/Postgres".into()),
    }
}

fn record_pool_metrics(target_name: &str, pool: &TargetPool) {
    metrics::gauge!(
        "gated_db_pool_size",
        "target" => target_name.to_string(),
    )
    .set(f64::from(pool.size()));
    metrics::gauge!(
        "gated_db_pool_idle",
        "target" => target_name.to_string(),
    )
    .set(pool.num_idle() as f64);
}

#[cfg(test)]
mod tests {
    use super::*;
    use gated_common::{TargetMySqlOptions, TargetOptions, TargetPostgresOptions, Tls};
    use gated_tls::TlsMode;

    fn mysql_target(id: Uuid, name: &str, port: u16) -> Target {
        Target {
            id,
            name: name.to_string(),
            description: String::new(),
            allow_roles: vec![],
            group_id: None,
            rate_limit_bytes_per_second: None,
            options: TargetOptions::MySql(TargetMySqlOptions {
                host: "localhost".into(),
                port,
                username: "u".into(),
                password: Some("p".into()),
                default_database_name: None,
                tls: Tls {
                    mode: TlsMode::Disabled,
                    verify: false,
                },
                readonly: false,
            }),
        }
    }

    fn postgres_target(id: Uuid, name: &str, port: u16) -> Target {
        Target {
            id,
            name: name.to_string(),
            description: String::new(),
            allow_roles: vec![],
            group_id: None,
            rate_limit_bytes_per_second: None,
            options: TargetOptions::Postgres(TargetPostgresOptions {
                host: "localhost".into(),
                port,
                username: "u".into(),
                password: Some("p".into()),
                default_database_name: None,
                idle_timeout: None,
                tls: Tls {
                    mode: TlsMode::Disabled,
                    verify: false,
                },
                readonly: false,
            }),
        }
    }

    #[test]
    fn fingerprint_changes_when_options_change() {
        let id = Uuid::new_v4();
        let base = mysql_target(id, "t", 3306);
        let other_port = mysql_target(id, "t", 3307);
        assert_ne!(
            compute_fingerprint(&base),
            compute_fingerprint(&other_port),
            "port change must flip fingerprint"
        );

        let renamed = mysql_target(id, "renamed", 3306);
        assert_eq!(
            compute_fingerprint(&base),
            compute_fingerprint(&renamed),
            "name change alone must not flip fingerprint (connection is identical)"
        );
    }

    #[test]
    fn fingerprint_differs_across_kinds_on_same_id() {
        let id = Uuid::new_v4();
        assert_ne!(
            compute_fingerprint(&mysql_target(id, "a", 3306)),
            compute_fingerprint(&postgres_target(id, "a", 3306)),
            "kind switch must flip fingerprint even at the same host/port"
        );
    }

    #[tokio::test]
    async fn invalidate_missing_id_is_noop() {
        let r = DbPoolRegistry::new();
        // No panic, no error — `invalidate` for an unknown target is fine.
        r.invalidate(Uuid::new_v4()).await;
        r.invalidate_all().await;
    }
}
