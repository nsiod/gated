use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use arc_swap::ArcSwapOption;
use gated_common::{GatedConfig, GlobalParams};
use sea_orm::DatabaseConnection;
use tokio::sync::{Mutex, RwLock};

use crate::db::{connect_to_db, populate_db};
use crate::db_pool_registry::DbPoolRegistry;
use crate::metrics::MetricsHandle;
use crate::rate_limiting::RateLimiterRegistry;
use crate::recordings::SessionRecordings;
use crate::sql_console_rate_limit::SqlConsoleRateLimiter;
use crate::{AuthStateStore, ConfigProviderEnum, DatabaseConfigProvider, State};

/// Shared runtime state of a running gateway. See REFACTOR-001 for the
/// rationale behind the per-field synchronization choice:
///
/// - `db`, `config`, `state`, `config_provider`, `auth_state_store`:
///   read-heavy or pure-read in hot paths, so `RwLock` lets concurrent
///   requests share a reader lock instead of serialising through one
///   `Mutex`.
/// - `admin_token`: read-only once set (no reload path); using
///   `ArcSwapOption` makes the read a lock-free atomic load.
/// - `recordings`, `rate_limiter_registry`: currently have balanced
///   read/write patterns (or all writes), so they stay on `Mutex`.
/// - `sql_console_rate_limiter`: already built around a lock-free
///   governor cell.
#[derive(Clone)]
pub struct Services {
    pub db: Arc<RwLock<DatabaseConnection>>,
    pub recordings: Arc<Mutex<SessionRecordings>>,
    pub config: Arc<RwLock<GatedConfig>>,
    pub state: Arc<RwLock<State>>,
    pub config_provider: Arc<Mutex<ConfigProviderEnum>>,
    pub auth_state_store: Arc<Mutex<AuthStateStore>>,
    pub admin_token: Arc<ArcSwapOption<String>>,
    pub rate_limiter_registry: Arc<Mutex<RateLimiterRegistry>>,
    pub sql_console_rate_limiter: Arc<SqlConsoleRateLimiter>,
    /// Per-target sqlx connection pool cache for the SQL Console. See
    /// [`DbPoolRegistry`] for invalidation semantics.
    pub db_pool_registry: Arc<DbPoolRegistry>,
    /// `Some` when `metrics.enable = true` and the global Prometheus
    /// recorder was installed at startup. The handle is used by the
    /// metrics HTTP listener to render the current snapshot.
    pub metrics: Option<Arc<MetricsHandle>>,
    pub global_params: Arc<GlobalParams>,
}

impl Services {
    pub async fn new(
        mut config: GatedConfig,
        admin_token: Option<String>,
        params: GlobalParams,
        metrics: Option<Arc<MetricsHandle>>,
    ) -> Result<Self> {
        let mut db = connect_to_db(&config, &params).await?;
        populate_db(&mut db, &mut config).await?;
        let db = Arc::new(RwLock::new(db));

        let recordings = SessionRecordings::new(db.clone(), &config, &params)?;
        let recordings = Arc::new(Mutex::new(recordings));

        let config = Arc::new(RwLock::new(config));

        let config_provider =
            Arc::new(Mutex::new(DatabaseConfigProvider::new(&db).await.into()));

        let auth_state_store = Arc::new(Mutex::new(AuthStateStore::new(config_provider.clone())));

        tokio::spawn({
            let auth_state_store = auth_state_store.clone();
            async move {
                loop {
                    auth_state_store.lock().await.vacuum().await;
                    tokio::time::sleep(Duration::from_secs(60)).await;
                }
            }
        });

        let mut rate_limiter_registry = RateLimiterRegistry::new(db.clone());
        rate_limiter_registry.refresh().await?;
        let rate_limiter_registry = Arc::new(Mutex::new(rate_limiter_registry));

        let sql_console_rate_limiter = Arc::new(SqlConsoleRateLimiter::new(&db).await?);
        let db_pool_registry = DbPoolRegistry::new();

        Ok(Self {
            db: db.clone(),
            recordings,
            config: config.clone(),
            state: State::new(&db, &rate_limiter_registry)?,
            rate_limiter_registry,
            sql_console_rate_limiter,
            db_pool_registry,
            config_provider,
            auth_state_store,
            admin_token: Arc::new(ArcSwapOption::new(admin_token.map(Arc::new))),
            metrics,
            global_params: Arc::new(params),
        })
    }
}
