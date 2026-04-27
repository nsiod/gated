use anyhow::{Context, Result};
use gated_common::GlobalParams;
use gated_core::db::open_db_connection;
use gated_core::healthcheck::{deep_check, DeepHealthOptions, DeepHealthStatus};
use tokio::time::timeout;

use crate::config::load_config;

pub(crate) async fn command(params: &GlobalParams, deep: bool, skip_lookups: bool) -> Result<()> {
    if deep {
        return run_deep(params, skip_lookups).await;
    }
    run_basic(params).await
}

async fn run_basic(params: &GlobalParams) -> Result<()> {
    let config = load_config(params, true)?;

    let scheme = if config.store.http.tls {
        "https"
    } else {
        "http"
    };
    let url = format!(
        "{}://{}/api/info",
        scheme,
        config.store.http.listen.address()
    );

    let mut builder = reqwest::Client::builder();
    if config.store.http.tls {
        builder = builder.danger_accept_invalid_certs(true).use_rustls_tls();
    }
    let client = builder.build()?;

    let response = timeout(std::time::Duration::from_secs(5), client.get(&url).send())
        .await
        .context("Timeout")?
        .context("Failed to send request")?;

    response.error_for_status()?;

    Ok(())
}

async fn run_deep(params: &GlobalParams, skip_lookups: bool) -> Result<()> {
    let config = load_config(params, true)?;
    // Use `open_db_connection` (not `Services::new`) so deep check sees
    // the real migration state rather than one where we just migrated.
    let db = open_db_connection(&config, params).await?;
    let report = deep_check(
        &db,
        &config,
        params.paths_relative_to(),
        DeepHealthOptions { skip_lookups },
    )
    .await;

    let json = serde_json::to_string_pretty(&report)?;
    println!("{json}");

    match report.status {
        DeepHealthStatus::Ok | DeepHealthStatus::Warn => Ok(()),
        // Exit 1 without an anyhow backtrace — Docker HEALTHCHECK only
        // reads the exit code, and the JSON we already printed is a
        // cleaner failure signal than a Rust stack trace.
        DeepHealthStatus::Fail => std::process::exit(1),
    }
}
