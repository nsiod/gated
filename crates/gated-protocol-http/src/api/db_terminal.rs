use std::io::{Read, Write};
use std::sync::Arc;
use std::time::Duration;

use futures::stream::SplitSink;
use futures::{SinkExt, StreamExt};
use gated_common::{Target, TargetOptions};
use gated_core::recordings::{TerminalRecorder, TerminalRecordingStreamId};
use gated_core::{ConfigProvider, Services, SessionHandle, SessionStateInit, State};
use poem::handler;
use poem::http::StatusCode;
use poem::web::websocket::{Message, WebSocket, WebSocketStream};
use poem::web::{Data, Path};
use poem::{IntoResponse, Response};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};
use tracing::*;

use super::super::common::{RequestAuthorization, SessionAuthorization};

const MAX_TARGET_NAME_LEN: usize = 128;
const WS_PING_INTERVAL: Duration = Duration::from_secs(30);
const PTY_READ_BUF: usize = 8192;

const MSG_TERMINAL_DATA: u8 = 0x00;
const MSG_RESIZE: u8 = 0x01;
const MSG_STATUS: u8 = 0x02;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DbKind {
    MySql,
    Postgres,
}

impl DbKind {
    fn parse(s: &str) -> Option<Self> {
        match s {
            "mysql" => Some(Self::MySql),
            "postgres" => Some(Self::Postgres),
            _ => None,
        }
    }

    fn protocol_name(self) -> &'static str {
        match self {
            Self::MySql => "MySQL",
            Self::Postgres => "PostgreSQL",
        }
    }
}

#[derive(Deserialize)]
struct ResizeMessage {
    cols: u16,
    rows: u16,
}

#[derive(Serialize)]
struct StatusMessage {
    status: String,
    message: String,
}

#[derive(Serialize, Debug)]
#[serde(tag = "type")]
enum DbTerminalRecordingMetadata {
    #[serde(rename = "mysql-terminal")]
    MySql { target: String },
    #[serde(rename = "postgres-terminal")]
    Postgres { target: String },
}

fn make_status_frame(status: &str, message: &str) -> Message {
    let msg = StatusMessage {
        status: status.to_string(),
        message: message.to_string(),
    };
    let json = serde_json::to_vec(&msg).unwrap_or_default();
    let mut frame = Vec::with_capacity(1 + json.len());
    frame.push(MSG_STATUS);
    frame.extend_from_slice(&json);
    Message::Binary(frame)
}

async fn send_status(sink: &mut SplitSink<WebSocketStream, Message>, status: &str, message: &str) {
    let _ = sink.send(make_status_frame(status, message)).await;
}

fn validate_target_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_TARGET_NAME_LEN
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

fn extract_username(auth: Option<Data<&RequestAuthorization>>) -> Option<String> {
    match auth.map(|a| a.0.clone()) {
        Some(RequestAuthorization::Session(SessionAuthorization::User(u))) => Some(u),
        Some(RequestAuthorization::Session(SessionAuthorization::Ticket { username, .. })) => {
            Some(username)
        }
        Some(RequestAuthorization::UserToken { username }) => Some(username),
        _ => None,
    }
}

/// Resolve target and authorize user. Only MySQL/Postgres targets are valid for this endpoint.
async fn resolve_and_authorize(
    services: &Services,
    username: &str,
    target_name: &str,
    expected_kind: DbKind,
) -> Result<(uuid::Uuid, Target), &'static str> {
    let mut config_provider = services.config_provider.lock().await;

    let users = config_provider.list_users().await.map_err(|e| {
        error!(%e, "Failed to list users");
        "Internal server error"
    })?;

    let user_id = users
        .iter()
        .find(|u| u.username == username)
        .map(|u| u.id)
        .ok_or("User not found")?;

    let authorized = config_provider
        .authorize_target(username, target_name)
        .await
        .map_err(|e| {
            error!(%e, "Authorization check failed");
            "Internal server error"
        })?;

    if !authorized {
        return Err("Access denied to target");
    }

    let targets = config_provider.list_targets().await.map_err(|e| {
        error!(%e, "Failed to list targets");
        "Internal server error"
    })?;

    let target = targets
        .into_iter()
        .find(|t| t.name == target_name)
        .ok_or("Target not found")?;

    match (&target.options, expected_kind) {
        (TargetOptions::MySql(_), DbKind::MySql) => Ok((user_id, target)),
        (TargetOptions::Postgres(_), DbKind::Postgres) => Ok((user_id, target)),
        _ => Err("Target kind does not match endpoint"),
    }
}

struct SpawnedProcess {
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Spawn the appropriate client binary inside a PTY with `rows`/`cols`.
fn spawn_db_client(target: &Target, kind: DbKind) -> Result<SpawnedProcess, String> {
    let (cmd, env_pwd_name, env_pwd_value) = match (&target.options, kind) {
        (TargetOptions::MySql(opts), DbKind::MySql) => {
            let mut cmd = CommandBuilder::new("mysql");
            cmd.arg("--protocol=tcp");
            cmd.arg(format!("--host={}", opts.host));
            cmd.arg(format!("--port={}", opts.port));
            cmd.arg(format!("--user={}", opts.username));
            match opts.tls.mode {
                gated_tls::TlsMode::Required => cmd.arg("--ssl-mode=REQUIRED"),
                gated_tls::TlsMode::Preferred => cmd.arg("--ssl-mode=PREFERRED"),
                gated_tls::TlsMode::Disabled => cmd.arg("--ssl-mode=DISABLED"),
            };
            cmd.arg("--default-character-set=utf8mb4");
            if let Some(db) = opts
                .default_database_name
                .as_ref()
                .filter(|s| !s.is_empty())
            {
                cmd.arg(db);
            }
            (cmd, "MYSQL_PWD", opts.password.clone().unwrap_or_default())
        }
        (TargetOptions::Postgres(opts), DbKind::Postgres) => {
            let mut cmd = CommandBuilder::new("psql");
            cmd.arg("--host");
            cmd.arg(&opts.host);
            cmd.arg("--port");
            cmd.arg(opts.port.to_string());
            cmd.arg("--username");
            cmd.arg(&opts.username);
            let sslmode = match opts.tls.mode {
                gated_tls::TlsMode::Required => "require",
                gated_tls::TlsMode::Preferred => "prefer",
                gated_tls::TlsMode::Disabled => "disable",
            };
            cmd.env("PGSSLMODE", sslmode);
            if let Some(db) = opts
                .default_database_name
                .as_ref()
                .filter(|s| !s.is_empty())
            {
                cmd.arg("--dbname");
                cmd.arg(db);
            }
            (cmd, "PGPASSWORD", opts.password.clone().unwrap_or_default())
        }
        _ => return Err("Unexpected target kind".into()),
    };

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("openpty: {e}"))?;

    let mut cmd = cmd;
    cmd.env(env_pwd_name, env_pwd_value);
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("spawn: {e}"))?;
    drop(pair.slave);

    Ok(SpawnedProcess {
        master: pair.master,
        child,
    })
}

/// Bridge WS <-> PTY. Reads from PTY in a blocking thread, writes to PTY via channel.
async fn bridge_websocket_pty(
    mut spawned: SpawnedProcess,
    sink: Arc<Mutex<SplitSink<WebSocketStream, Message>>>,
    mut source: futures::stream::SplitStream<WebSocketStream>,
    recorder: Option<TerminalRecorder>,
) {
    let recorder_ref = Arc::new(Mutex::new(recorder));
    let recorder_out = recorder_ref.clone();

    // PTY -> WS (blocking reader on dedicated task)
    let mut reader = match spawned.master.try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            error!(%e, "Failed to clone PTY reader");
            let mut s = sink.lock().await;
            let _ = s
                .send(make_status_frame("error", "PTY read channel unavailable"))
                .await;
            return;
        }
    };

    let (out_tx, mut out_rx) = mpsc::channel::<Vec<u8>>(64);
    let reader_handle = std::thread::spawn(move || {
        let mut buf = vec![0u8; PTY_READ_BUF];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // `Read::read` guarantees `n <= buf.len()`, so the slice
                    // is always in-bounds. Using `.get` would silently drop
                    // data on violation — we'd rather catch a read contract
                    // break at the slice.
                    #[allow(clippy::indexing_slicing, reason = "n bounded by Read::read contract")]
                    let chunk = buf[..n].to_vec();
                    if out_tx.blocking_send(chunk).is_err() {
                        break;
                    }
                }
                Err(e) => {
                    debug!(%e, "PTY reader ended");
                    break;
                }
            }
        }
    });

    // WS -> PTY (blocking writer via channel)
    let mut writer = match spawned.master.take_writer() {
        Ok(w) => w,
        Err(e) => {
            error!(%e, "Failed to acquire PTY writer");
            let mut s = sink.lock().await;
            let _ = s
                .send(make_status_frame("error", "PTY write channel unavailable"))
                .await;
            return;
        }
    };

    let (in_tx, mut in_rx) = mpsc::channel::<Vec<u8>>(64);
    let writer_handle = std::thread::spawn(move || {
        while let Some(chunk) = in_rx.blocking_recv() {
            if writer.write_all(&chunk).is_err() {
                break;
            }
            let _ = writer.flush();
        }
    });

    // Output task: PTY bytes -> WS binary frames + periodic ping
    let sink_out = sink.clone();
    let output_task = tokio::spawn(async move {
        let mut ping_interval = tokio::time::interval(WS_PING_INTERVAL);
        ping_interval.tick().await;
        loop {
            tokio::select! {
                chunk = out_rx.recv() => {
                    match chunk {
                        Some(bytes) => {
                            if let Some(ref mut rec) = *recorder_out.lock().await {
                                let _ = rec
                                    .write(TerminalRecordingStreamId::Output, &bytes)
                                    .await;
                            }
                            let mut frame = Vec::with_capacity(1 + bytes.len());
                            frame.push(MSG_TERMINAL_DATA);
                            frame.extend_from_slice(&bytes);
                            let mut s = sink_out.lock().await;
                            if s.send(Message::Binary(frame)).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
                _ = ping_interval.tick() => {
                    let mut s = sink_out.lock().await;
                    if s.send(Message::Ping(Vec::new())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Input task: WS binary frames -> PTY writer / resize
    let master_for_resize = Arc::new(Mutex::new(spawned.master));
    let master_resize = master_for_resize.clone();
    let input_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = source.next().await {
            match msg {
                Message::Binary(data) if !data.is_empty() => {
                    let Some((&msg_type, payload)) = data.split_first() else {
                        continue;
                    };
                    match msg_type {
                        MSG_TERMINAL_DATA => {
                            if let Some(ref mut rec) = *recorder_ref.lock().await {
                                let _ = rec.write(TerminalRecordingStreamId::Input, payload).await;
                            }
                            if in_tx.send(payload.to_vec()).await.is_err() {
                                break;
                            }
                        }
                        MSG_RESIZE => {
                            if let Ok(resize) = serde_json::from_slice::<ResizeMessage>(payload) {
                                if let Some(ref mut rec) = *recorder_ref.lock().await {
                                    let _ = rec
                                        .write_pty_resize(
                                            u32::from(resize.cols),
                                            u32::from(resize.rows),
                                        )
                                        .await;
                                }
                                let master = master_resize.lock().await;
                                let _ = master.resize(PtySize {
                                    rows: resize.rows,
                                    cols: resize.cols,
                                    pixel_width: 0,
                                    pixel_height: 0,
                                });
                            }
                        }
                        _ => {}
                    }
                }
                Message::Pong(_) => {}
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = output_task => {}
        _ = input_task => {}
    }

    // Cleanup: kill child, wait for reader thread to exit
    let _ = spawned.child.kill();
    // Drop master to unblock reader
    drop(master_for_resize);
    let _ = reader_handle.join();
    let _ = writer_handle.join();
}

async fn handle_db_terminal(
    ws: WebSocket,
    target_name: String,
    kind: DbKind,
    services: Services,
    auth: Option<Data<&RequestAuthorization>>,
) -> Response {
    if !validate_target_name(&target_name) {
        warn!(
            target = %target_name,
            kind = ?kind,
            protocol = "db_terminal",
            "db_terminal_invalid_target_name"
        );
        return Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body("Invalid target name");
    }

    let username = match extract_username(auth) {
        Some(u) => u,
        None => {
            warn!(
                target = %target_name,
                kind = ?kind,
                protocol = "db_terminal",
                "db_terminal_unauthenticated"
            );
            return Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body("Not authenticated");
        }
    };

    ws.on_upgrade(move |socket| async move {
        let (mut sink, source) = socket.split();

        let (user_id, target) =
            match resolve_and_authorize(&services, &username, &target_name, kind).await {
                Ok(t) => t,
                Err(msg) => {
                    warn!(
                        username = %username,
                        target = %target_name,
                        kind = ?kind,
                        protocol = "db_terminal",
                        reason = %msg,
                        "db_terminal_authorize_failed"
                    );
                    send_status(&mut sink, "error", msg).await;
                    return;
                }
            };

        if let Err(e) = services.sql_console_rate_limiter.check(user_id, target.id) {
            metrics::counter!(
                "gated_rate_limit_rejected_total",
                "endpoint" => "db_terminal",
            )
            .increment(1);
            warn!(
                %username,
                target = %target.name,
                scope = e.scope(),
                kind = ?kind,
                "db_terminal_rate_limit_exceeded"
            );
            send_status(
                &mut sink,
                "rate_limited",
                "Request rate limit exceeded; try again shortly",
            )
            .await;
            return;
        }

        let session_handle = match State::register_session(
            &services.state,
            &kind.protocol_name(),
            SessionStateInit {
                remote_address: None,
                handle: Box::new(DbTerminalSessionHandle),
            },
        )
        .await
        {
            Ok(h) => h,
            Err(e) => {
                error!(%e, "Failed to register session");
                send_status(&mut sink, "error", "Internal server error").await;
                return;
            }
        };

        let session_id = session_handle.lock().await.id();
        let user_info = gated_common::auth::AuthStateUserInfo {
            id: uuid::Uuid::nil(),
            username: username.clone(),
        };
        let _ = session_handle.lock().await.set_user_info(user_info).await;
        let _ = session_handle.lock().await.set_target(&target).await;

        let metadata = match kind {
            DbKind::MySql => DbTerminalRecordingMetadata::MySql {
                target: target.name.clone(),
            },
            DbKind::Postgres => DbTerminalRecordingMetadata::Postgres {
                target: target.name.clone(),
            },
        };

        let recorder: Option<TerminalRecorder> = {
            let mut recordings = services.recordings.lock().await;
            match recordings
                .start::<TerminalRecorder, _>(&session_id, None, metadata)
                .await
            {
                Ok(r) => Some(r),
                Err(e) => {
                    debug!(%e, "Recording not available (may be disabled)");
                    None
                }
            }
        };

        let spawned = match spawn_db_client(&target, kind) {
            Ok(s) => s,
            Err(e) => {
                error!(%e, "Failed to spawn DB client");
                send_status(&mut sink, "error", &format!("Failed to start client: {e}")).await;
                return;
            }
        };

        send_status(
            &mut sink,
            "connected",
            &format!("{} client started", kind.protocol_name()),
        )
        .await;

        info!(
            %session_id,
            username = %username,
            target = %target.name,
            kind = ?kind,
            protocol = "db_terminal",
            "db_terminal_session_started"
        );

        let started = std::time::Instant::now();
        let sink = Arc::new(Mutex::new(sink));
        bridge_websocket_pty(spawned, sink, source, recorder).await;

        info!(
            %session_id,
            username = %username,
            target = %target.name,
            kind = ?kind,
            protocol = "db_terminal",
            duration_ms = started.elapsed().as_millis() as u64,
            "db_terminal_session_ended"
        );
    })
    .into_response()
}

struct DbTerminalSessionHandle;
impl SessionHandle for DbTerminalSessionHandle {
    fn close(&mut self) {}
}

#[handler]
pub async fn api_mysql_terminal(
    ws: WebSocket,
    Path(target_name): Path<String>,
    services: Data<&Services>,
    auth: Option<Data<&RequestAuthorization>>,
) -> Response {
    handle_db_terminal(ws, target_name, DbKind::MySql, services.clone(), auth).await
}

#[handler]
pub async fn api_postgres_terminal(
    ws: WebSocket,
    Path(target_name): Path<String>,
    services: Data<&Services>,
    auth: Option<Data<&RequestAuthorization>>,
) -> Response {
    handle_db_terminal(ws, target_name, DbKind::Postgres, services.clone(), auth).await
}

#[allow(dead_code)]
fn _parse_kind(s: &str) -> Option<DbKind> {
    DbKind::parse(s)
}
