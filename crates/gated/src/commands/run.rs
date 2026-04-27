use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use futures::{FutureExt, StreamExt};
use gated_common::version::gated_version;
use gated_common::{GatedConfig, GlobalParams, ListenEndpoint};
use gated_core::db::cleanup_db;
use gated_core::healthcheck::{deep_check, DeepHealthOptions, DeepHealthStatus};
use gated_core::logging::install_database_logger;
use gated_core::metrics::MetricsHandle;
use gated_core::{ConfigProvider, ProtocolServer, Services};
use gated_protocol_http::HTTPProtocolServer;
use gated_protocol_kubernetes::KubernetesProtocolServer;
use gated_protocol_mysql::MySQLProtocolServer;
use gated_protocol_postgres::PostgresProtocolServer;
use gated_protocol_ssh::SSHProtocolServer;
use poem::http::header::CONTENT_TYPE;
use poem::http::StatusCode;
use poem::{get, handler, EndpointExt, IntoResponse, Response, Route, Server};
#[cfg(target_os = "linux")]
use sd_notify::NotifyState;
use tokio::signal::unix::SignalKind;
use tracing::*;

use crate::config::{load_config, watch_config};

async fn run_protocol_server<T: ProtocolServer + Send + 'static>(
    server: T,
    address: ListenEndpoint,
) -> Result<()> {
    let name = server.name();
    info!("Accepting {name} connections on {address:?}");
    server
        .run(address)
        .await
        .with_context(|| format!("protocol server: {name}"))
}

#[handler]
fn metrics_endpoint(handle: poem::web::Data<&Arc<MetricsHandle>>) -> Response {
    // Prometheus exposition format content type; version keeps Grafana
    // Agent / vmagent happy even though Prometheus itself is permissive.
    handle
        .render()
        .with_header(CONTENT_TYPE, "text/plain; version=0.0.4")
        .into_response()
}

#[handler]
fn healthz_endpoint() -> Response {
    // Liveness is purely "the process is running and can serve HTTP".
    // Anything fancier belongs in /readyz. K8s restarts on liveness
    // failures, so keep this cheap and hard to break.
    "ok".with_header(CONTENT_TYPE, "text/plain").into_response()
}

#[derive(Clone)]
struct ReadinessState {
    services: Services,
    config: GatedConfig,
    paths_relative_to: PathBuf,
}

#[handler]
async fn readyz_endpoint(state: poem::web::Data<&ReadinessState>) -> Response {
    // Wrap the sweep in an outer bound so a K8s probe timeout of 1–2s
    // always gets a decisive 200 or 503 instead of a hung connection.
    // Individual DB probes run concurrently inside `deep_check`, so a
    // healthy DB returns in well under 100ms.
    let db = state.services.db.read().await;
    let fut = deep_check(
        &db,
        &state.config,
        &state.paths_relative_to,
        DeepHealthOptions { skip_lookups: true },
    );
    let report = match tokio::time::timeout(std::time::Duration::from_millis(1500), fut).await {
        Ok(r) => r,
        Err(_) => {
            // Timeout itself is a failure signal; synthesize a report
            // so the caller still gets structured JSON.
            use gated_core::healthcheck::{DeepHealthCheck, DeepHealthReport};
            DeepHealthReport {
                status: DeepHealthStatus::Fail,
                generated_at: chrono::Utc::now(),
                checks: vec![DeepHealthCheck {
                    name: "deep_check".into(),
                    status: DeepHealthStatus::Fail,
                    message: Some("deep check exceeded 1500ms guard".into()),
                }],
            }
        }
    };
    drop(db);
    let status_code = match report.status {
        DeepHealthStatus::Ok | DeepHealthStatus::Warn => StatusCode::OK,
        DeepHealthStatus::Fail => StatusCode::SERVICE_UNAVAILABLE,
    };
    let body = serde_json::to_vec(&report).unwrap_or_else(|_| b"{}".to_vec());
    Response::builder()
        .status(status_code)
        .header(CONTENT_TYPE, "application/json")
        .body(body)
}

/// Observability listener: serves `/metrics`, `/healthz`, and `/readyz`
/// on a single loopback-bound port. Mounted only when
/// `metrics.enable = true` — deployments that need liveness/readiness
/// probes but not metrics should still flip the switch (documented in
/// `docs/ops/healthcheck.md`).
async fn run_observability_server(
    address: ListenEndpoint,
    handle: Arc<MetricsHandle>,
    readiness: ReadinessState,
) -> Result<()> {
    info!("Serving /metrics /healthz /readyz on {address:?}");
    let listener = address.poem_listener().await?;
    let app = Route::new()
        .at("/metrics", get(metrics_endpoint).data(handle))
        .at("/healthz", get(healthz_endpoint))
        .at("/readyz", get(readyz_endpoint).data(readiness));
    Server::new(listener)
        .run(app)
        .await
        .context("observability HTTP server")
}

pub(crate) async fn command(params: &GlobalParams, enable_admin_token: bool) -> Result<()> {
    let version = gated_version();
    info!(%version, "Gated");

    let admin_token = enable_admin_token.then(|| {
        std::env::var("GATED_ADMIN_TOKEN").unwrap_or_else(|_| {
            error!("`GATED_ADMIN_TOKEN` env variable must set when using --enable-admin-token");
            std::process::exit(1);
        })
    });

    let config = match load_config(params, true) {
        Ok(config) => config,
        Err(error) => {
            error!(?error, "Failed to load config file");
            std::process::exit(1);
        }
    };

    // `metrics` macros are no-ops until a recorder is installed, so the
    // emission sites don't care whether this succeeds. If the user
    // enabled metrics but we can't install the recorder (e.g. another
    // dependency already called `install_recorder`), log and carry on
    // with metrics disabled rather than failing startup.
    let metrics_handle = if config.store.metrics.enable {
        match gated_core::metrics::install_recorder() {
            Ok(h) => Some(h),
            Err(e) => {
                error!(
                    ?e,
                    "Failed to install Prometheus recorder; metrics disabled"
                );
                None
            }
        }
    } else {
        None
    };

    let services = Services::new(
        config.clone(),
        admin_token,
        params.clone(),
        metrics_handle.clone(),
    )
    .await?;

    install_database_logger(services.db.clone());

    if console::user_attended() {
        info!("--------------------------------------------");
        info!("Gated is now running.");
    }

    let mut protocol_futures = futures::stream::FuturesUnordered::new();

    protocol_futures.push(
        run_protocol_server(
            HTTPProtocolServer::new(&services).await?,
            config.store.http.listen.clone(),
        )
        .boxed(),
    );

    if config.store.ssh.enable {
        protocol_futures.push(
            run_protocol_server(
                SSHProtocolServer::new(&services).await?,
                config.store.ssh.listen.clone(),
            )
            .boxed(),
        );
    }

    if config.store.mysql.enable {
        protocol_futures.push(
            run_protocol_server(
                MySQLProtocolServer::new(&services).await?,
                config.store.mysql.listen.clone(),
            )
            .boxed(),
        );
    }

    if config.store.postgres.enable {
        protocol_futures.push(
            run_protocol_server(
                PostgresProtocolServer::new(&services).await?,
                config.store.postgres.listen.clone(),
            )
            .boxed(),
        );
    }

    if config.store.kubernetes.enable {
        protocol_futures.push(
            KubernetesProtocolServer::new(&services)
                .await?
                .run(config.store.kubernetes.listen.clone())
                .boxed(),
        );
    }

    if let Some(handle) = metrics_handle {
        let readiness = ReadinessState {
            services: services.clone(),
            config: config.clone(),
            paths_relative_to: params.paths_relative_to().clone(),
        };
        protocol_futures.push(
            run_observability_server(config.store.metrics.listen.clone(), handle, readiness)
                .boxed(),
        );
    }

    tokio::spawn({
        let services = services.clone();
        async move {
            loop {
                let retention = { services.config.read().await.store.log.retention };
                let interval = retention / 10;
                #[allow(clippy::explicit_auto_deref)]
                match cleanup_db(
                    &mut *services.db.write().await,
                    &mut *services.recordings.lock().await,
                    &retention,
                )
                .await
                {
                    Err(error) => error!(?error, "Failed to cleanup the database"),
                    Ok(_) => debug!("Database cleaned up, next in {:?}", interval),
                }
                tokio::time::sleep(interval).await;
            }
        }
    });

    #[cfg(target_os = "linux")]
    if let Ok(true) = sd_notify::booted() {
        use std::time::Duration;
        tokio::spawn(async {
            if let Err(error) = async {
                sd_notify::notify(false, &[NotifyState::Ready])?;
                loop {
                    sd_notify::notify(false, &[NotifyState::Watchdog])?;
                    tokio::time::sleep(Duration::from_secs(15)).await;
                }
                #[allow(unreachable_code)]
                Ok::<(), anyhow::Error>(())
            }
            .await
            {
                error!(?error, "Failed to communicate with systemd");
            }
        });
    }

    drop(config);

    if protocol_futures.is_empty() {
        anyhow::bail!("No protocols are enabled in the config file, exiting");
    }

    tokio::spawn(watch_config_and_reload(services.clone()));

    let mut sigint = tokio::signal::unix::signal(SignalKind::interrupt())?;

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {
                std::process::exit(1);
            }
            _ = sigint.recv() => {
                break
            }
            result = protocol_futures.next() => {
                match result {
                    Some(Err(error)) => {
                        error!(?error, "Server error");
                        std::process::exit(1);
                    },
                    None => break,
                    _ => (),
                }
            }
        }
    }

    info!("Exiting");
    Ok(())
}

pub async fn watch_config_and_reload(services: Services) -> Result<()> {
    let mut reload_event = watch_config(&services.global_params, services.config.clone())?;

    while let Ok(()) = reload_event.recv().await {
        metrics::counter!("gated_config_reload_total").increment(1);
        let state = services.state.read().await;
        let mut cp = services.config_provider.lock().await;
        // TODO no longer happens since everything is in the DB
        for (id, session) in state.sessions.iter() {
            let mut session = session.lock().await;
            if let (Some(user_info), Some(target)) =
                (session.user_info.as_ref(), session.target.as_ref())
            {
                if !cp
                    .authorize_target(&user_info.username, &target.name)
                    .await?
                {
                    warn!(sesson_id=%id, %user_info.username, target=&target.name, "Session no longer authorized after config reload");
                    session.handle.close();
                }
            }
        }
    }

    Ok(())
}
