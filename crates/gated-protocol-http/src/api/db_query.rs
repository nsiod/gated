//! SQL Console backend: schema introspection + ad-hoc query execution
//! against MySQL and PostgreSQL targets.
//!
//! Endpoints (mounted under `/api`):
//! - `GET  /db/schemas/:target`
//! - `GET  /db/tables/:target?schema=…`
//! - `GET  /db/columns/:target?schema=…&table=…`
//! - `POST /db/query/:target`      body: `{ sql, limit? }`
//!
//! Per-target connection pools are cached in a module-level registry
//! (one `MySqlPool` or `PgPool` per target name, `max_connections = 5`).
//! Each query runs with `statement_timeout = 30s` and the result is
//! truncated once the JSON payload grows past 5 MiB.

use std::time::{Duration, Instant};

use chrono::Utc;
use gated_common::{Target, TargetOptions};
use gated_core::db_pool_registry::TargetPool;
use gated_core::recordings::{SqlAuditRecordingItem, SqlAuditSessionMetadata, StructuredRecorder};
use gated_core::{ConfigProvider, Services};
use gated_db_entities::Session;
use poem::web::Data;
use poem_openapi::param::{Path, Query};
use poem_openapi::payload::Json;
use poem_openapi::{ApiResponse, Object, OpenApi};
use sea_orm::{ActiveModelTrait, EntityTrait};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::mysql::{MySqlColumn, MySqlPool};
use sqlx::postgres::{PgColumn, PgPool};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use tracing::*;
use uuid::Uuid;

use crate::api::AnySecurityScheme;
use crate::common::{endpoint_auth, RequestAuthorization, SessionAuthorization};

const MAX_TARGET_NAME_LEN: usize = 128;
const DEFAULT_LIMIT: i64 = 1000;
const MAX_LIMIT: i64 = 10_000;
const MAX_RESULT_BYTES: usize = 5 * 1024 * 1024;
const STATEMENT_TIMEOUT: Duration = Duration::from_secs(30);

fn validate_target_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_TARGET_NAME_LEN
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

fn extract_username(auth: Option<&RequestAuthorization>) -> Option<String> {
    match auth {
        Some(RequestAuthorization::Session(SessionAuthorization::User(u))) => Some(u.clone()),
        Some(RequestAuthorization::Session(SessionAuthorization::Ticket { username, .. })) => {
            Some(username.clone())
        }
        Some(RequestAuthorization::UserToken { username }) => Some(username.clone()),
        _ => None,
    }
}

async fn resolve_and_authorize(
    services: &Services,
    username: &str,
    target_name: &str,
) -> Result<(Uuid, Target), DbError> {
    let mut config_provider = services.config_provider.lock().await;

    let users = config_provider.list_users().await.map_err(|e| {
        error!(%e, "Failed to list users");
        DbError::internal("Internal server error")
    })?;
    let user_id = users
        .iter()
        .find(|u| u.username == username)
        .map(|u| u.id)
        .ok_or_else(|| DbError::unauthorized("User not found"))?;

    let authorized = config_provider
        .authorize_target(username, target_name)
        .await
        .map_err(|e| {
            error!(%e, "Authorization check failed");
            DbError::internal("Internal server error")
        })?;
    if !authorized {
        return Err(DbError::forbidden("Access denied to target"));
    }

    let targets = config_provider.list_targets().await.map_err(|e| {
        error!(%e, "Failed to list targets");
        DbError::internal("Internal server error")
    })?;
    let target = targets
        .into_iter()
        .find(|t| t.name == target_name)
        .ok_or_else(|| DbError::not_found("Target not found"))?;

    match target.options {
        TargetOptions::MySql(_) | TargetOptions::Postgres(_) => Ok((user_id, target)),
        _ => Err(DbError::bad_request("Target is not a database")),
    }
}

fn target_readonly(target: &Target) -> bool {
    match &target.options {
        TargetOptions::MySql(o) => o.readonly,
        TargetOptions::Postgres(o) => o.readonly,
        _ => false,
    }
}

// Readonly enforcement delegates to the AST-free tokenizer in
// `sql_validation`. The legacy prefix check (`classify_sql`) is still
// used for the `statement_kind` column on audit logs.

#[derive(Object, Serialize)]
struct SchemaList {
    schemas: Vec<String>,
    default_schema: Option<String>,
    readonly: bool,
    kind: String,
}

#[derive(Object, Serialize)]
struct TableList {
    tables: Vec<TableInfo>,
}

#[derive(Object, Serialize)]
struct TableInfo {
    name: String,
    #[oai(rename = "type")]
    kind: String,
}

#[derive(Object, Serialize)]
struct ColumnList {
    columns: Vec<ColumnInfo>,
}

#[derive(Object, Serialize)]
struct ColumnInfo {
    name: String,
    data_type: String,
    nullable: bool,
    primary_key: bool,
}

#[derive(Object)]
pub struct QueryRequest {
    pub sql: String,
    pub limit: Option<i64>,
    pub console_session_key: Option<String>,
}

#[derive(Object, Serialize)]
struct QueryResponse {
    columns: Vec<QueryColumn>,
    rows: Vec<Vec<serde_json::Value>>,
    rows_affected: Option<u64>,
    truncated: bool,
    elapsed_ms: u64,
    limit: i64,
    statement_kind: String,
}

struct QueryResultBody {
    columns: Vec<QueryColumn>,
    rows: Vec<Vec<serde_json::Value>>,
    rows_affected: Option<u64>,
    truncated: bool,
}

#[derive(Object, Serialize)]
struct QueryColumn {
    name: String,
    type_name: String,
}

#[derive(Object, Serialize)]
pub struct ErrorBody {
    error: String,
}

impl ErrorBody {
    fn new(msg: impl Into<String>) -> Self {
        Self { error: msg.into() }
    }
}

#[derive(ApiResponse)]
pub enum DbError {
    #[oai(status = 400)]
    BadRequest(Json<ErrorBody>),
    #[oai(status = 401)]
    Unauthorized(Json<ErrorBody>),
    #[oai(status = 403)]
    Forbidden(Json<ErrorBody>),
    #[oai(status = 404)]
    NotFound(Json<ErrorBody>),
    #[oai(status = 429)]
    RateLimited(Json<ErrorBody>, #[oai(header = "Retry-After")] u64),
    #[oai(status = 500)]
    Internal(Json<ErrorBody>),
    #[oai(status = 502)]
    BadGateway(Json<ErrorBody>),
}

impl DbError {
    fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(Json(ErrorBody::new(msg)))
    }
    fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(Json(ErrorBody::new(msg)))
    }
    fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(Json(ErrorBody::new(msg)))
    }
    fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(Json(ErrorBody::new(msg)))
    }
    fn rate_limited(retry_after_seconds: u64) -> Self {
        Self::RateLimited(
            Json(ErrorBody::new("rate limit exceeded")),
            retry_after_seconds,
        )
    }
    fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(Json(ErrorBody::new(msg)))
    }
    fn bad_gateway(msg: impl Into<String>) -> Self {
        Self::BadGateway(Json(ErrorBody::new(msg)))
    }
}

fn classify_sql(sql: &str) -> &'static str {
    let mut s = sql.trim_start();
    loop {
        if let Some(rest) = s.strip_prefix("--") {
            let end = rest.find('\n').map(|i| i + 1).unwrap_or(rest.len());
            s = rest[end..].trim_start();
            continue;
        }
        if let Some(rest) = s.strip_prefix("/*") {
            if let Some(idx) = rest.find("*/") {
                s = rest[idx + 2..].trim_start();
                continue;
            }
            break;
        }
        break;
    }
    let first: String = s
        .chars()
        .take_while(|c| c.is_ascii_alphabetic())
        .map(|c| c.to_ascii_uppercase())
        .collect();
    match first.as_str() {
        "SELECT" | "WITH" => "SELECT",
        "SHOW" => "SHOW",
        "EXPLAIN" => "EXPLAIN",
        "DESC" | "DESCRIBE" => "DESCRIBE",
        "INSERT" => "INSERT",
        "UPDATE" => "UPDATE",
        "DELETE" => "DELETE",
        "CREATE" => "CREATE",
        "ALTER" => "ALTER",
        "DROP" => "DROP",
        "TRUNCATE" => "TRUNCATE",
        "" => "UNKNOWN",
        _ => "OTHER",
    }
}

fn sql_console_session_id_from_key(key: &str) -> Uuid {
    let digest = Sha256::digest(key.as_bytes());
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes)
}

fn target_kind_name(target: &Target) -> &'static str {
    match target.options {
        TargetOptions::MySql(_) => "mysql",
        TargetOptions::Postgres(_) => "postgres",
        _ => "unknown",
    }
}

async fn record_sql_console_request(
    services: &Services,
    session_id: Uuid,
    recording_name: &str,
    target: &Target,
    sql: &str,
    statement_kind: &str,
    readonly: bool,
    elapsed_ms: u64,
    success: bool,
    error: Option<String>,
) -> Result<(), DbError> {
    let metadata = SqlAuditSessionMetadata::SqlConsoleSession {
        target_kind: target_kind_name(target).to_string(),
        target: target.name.clone(),
    };
    let item = SqlAuditRecordingItem::Query {
        timestamp: Utc::now(),
        target_kind: target_kind_name(target).to_string(),
        target: target.name.clone(),
        database: None,
        sql: sql.to_string(),
        statement_kind: statement_kind.to_string(),
        readonly: Some(readonly),
        elapsed_ms,
        success,
        error,
    };

    let mut recordings = services.recordings.lock().await;
    let mut recorder = recordings
        .start::<StructuredRecorder, _>(&session_id, Some(recording_name.to_string()), metadata)
        .await
        .map_err(|err| {
            debug!(%err, %session_id, "SQL Console recording not available");
            DbError::internal("Failed to start SQL Console recording")
        })?;
    recorder.write_item(&item).await.map_err(|err| {
        debug!(%err, %session_id, "SQL Console recording not available");
        DbError::internal("Failed to write SQL Console recording")
    })?;
    Ok(())
}

async fn ensure_sql_console_group_session(
    services: &Services,
    session_id: Uuid,
    username: &str,
    target: &Target,
) -> Result<(), DbError> {
    if Session::Entity::find_by_id(session_id)
        .one(&*services.db.read().await)
        .await
        .map_err(|e| {
            error!(%e, "Failed to query SQL Console grouping session");
            DbError::internal("Internal server error")
        })?
        .is_some()
    {
        return Ok(());
    }

    use sea_orm::ActiveValue::Set;

    let model = Session::ActiveModel {
        id: Set(session_id),
        started: Set(Utc::now()),
        remote_address: Set(String::new()),
        protocol: Set("DbQuery".to_string()),
        username: Set(Some(username.to_string())),
        target_snapshot: Set(Some(serde_json::to_string(target).map_err(|e| {
            error!(%e, "Failed to serialize SQL Console target snapshot");
            DbError::internal("Internal server error")
        })?)),
        ..Default::default()
    };

    model
        .insert(&*services.db.read().await)
        .await
        .map_err(|e| {
            error!(%e, "Failed to create SQL Console grouping session");
            DbError::internal("Internal server error")
        })?;
    Ok(())
}

// ── MySQL decoding ─────────────────────────────────────────────────────────────

/// Returns true if the raw column is NULL on the wire, regardless of
/// declared type. Using `try_get::<Option<&str>>` as a NULL probe fails
/// on non-text columns and would silently mistreat e.g. INT4 as NULL.
fn pg_is_null(row: &sqlx::postgres::PgRow, idx: usize) -> bool {
    match row.try_get_raw(idx) {
        Ok(raw) => raw.is_null(),
        Err(_) => true,
    }
}

fn mysql_is_null(row: &sqlx::mysql::MySqlRow, idx: usize) -> bool {
    match row.try_get_raw(idx) {
        Ok(raw) => raw.is_null(),
        Err(_) => true,
    }
}

fn decode_mysql_value(row: &sqlx::mysql::MySqlRow, col: &MySqlColumn) -> serde_json::Value {
    let idx = col.ordinal();
    let ty = col.type_info().name();

    if mysql_is_null(row, idx) {
        return serde_json::Value::Null;
    }

    // MySQL: use the exact Rust type that sqlx-mysql maps to each SQL type.
    // Using i64 for TINYINT/SMALLINT/INT would silently fail-decode on
    // servers that don't widen automatically, yielding a row of NULLs.
    let as_json = match ty {
        "BOOLEAN" | "TINYINT(1)" => row
            .try_get::<bool, _>(idx)
            .ok()
            .map(serde_json::Value::Bool),
        "TINYINT" => row.try_get::<i8, _>(idx).ok().map(|v| serde_json::json!(v)),
        "SMALLINT" => row
            .try_get::<i16, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "INT" | "MEDIUMINT" => row
            .try_get::<i32, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "BIGINT" => row
            .try_get::<i64, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "TINYINT UNSIGNED" => row.try_get::<u8, _>(idx).ok().map(|v| serde_json::json!(v)),
        "SMALLINT UNSIGNED" => row
            .try_get::<u16, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "INT UNSIGNED" | "MEDIUMINT UNSIGNED" => row
            .try_get::<u32, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "BIGINT UNSIGNED" => row
            .try_get::<u64, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "FLOAT" => row
            .try_get::<f32, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "DOUBLE" => row
            .try_get::<f64, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "DECIMAL" | "NUMERIC" => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
        "VARCHAR" | "CHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" | "ENUM" | "SET" => {
            row.try_get::<Vec<u8>, _>(idx)
                .ok()
                .map(|b| serde_json::Value::String(String::from_utf8_lossy(&b).into_owned()))
        }
        "JSON" => row.try_get::<serde_json::Value, _>(idx).ok(),
        "DATE" | "TIME" | "DATETIME" | "TIMESTAMP" => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
        "YEAR" => row
            .try_get::<u16, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "BINARY" | "VARBINARY" | "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" | "BIT"
        | "GEOMETRY" => row
            .try_get::<Vec<u8>, _>(idx)
            .ok()
            .map(|b| serde_json::Value::String(format!("0x{}", hex::encode(&b)))),
        _ => row
            .try_get::<Vec<u8>, _>(idx)
            .ok()
            .map(|b| serde_json::Value::String(String::from_utf8_lossy(&b).into_owned())),
    };

    as_json.unwrap_or_else(|| serde_json::Value::String(format!("[unsupported {ty}]")))
}

fn decode_postgres_value(row: &sqlx::postgres::PgRow, col: &PgColumn) -> serde_json::Value {
    let idx = col.ordinal();
    let ty = col.type_info().name();

    if pg_is_null(row, idx) {
        return serde_json::Value::Null;
    }

    let as_json = match ty {
        "BOOL" => row
            .try_get::<bool, _>(idx)
            .ok()
            .map(serde_json::Value::Bool),
        "INT2" => row
            .try_get::<i16, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "INT4" => row
            .try_get::<i32, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "INT8" => row
            .try_get::<i64, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "FLOAT4" => row
            .try_get::<f32, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "FLOAT8" => row
            .try_get::<f64, _>(idx)
            .ok()
            .map(|v| serde_json::json!(v)),
        "NUMERIC" => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
        "TEXT" | "VARCHAR" | "CHAR" | "BPCHAR" | "NAME" | "CITEXT" => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
        "JSON" | "JSONB" => row.try_get::<serde_json::Value, _>(idx).ok(),
        "UUID" => row
            .try_get::<Uuid, _>(idx)
            .ok()
            .map(|v| serde_json::Value::String(v.to_string())),
        "DATE" | "TIME" | "TIMETZ" | "TIMESTAMP" | "TIMESTAMPTZ" | "INTERVAL" => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
        "BYTEA" => row
            .try_get::<Vec<u8>, _>(idx)
            .ok()
            .map(|b| serde_json::Value::String(format!("0x{}", hex::encode(&b)))),
        _ => row
            .try_get::<String, _>(idx)
            .ok()
            .map(serde_json::Value::String),
    };

    as_json.unwrap_or_else(|| serde_json::Value::String(format!("[unsupported {ty}]")))
}

fn is_system_schema_mysql(name: &str) -> bool {
    matches!(
        name,
        "mysql" | "performance_schema" | "information_schema" | "sys"
    )
}

fn is_system_schema_postgres(name: &str) -> bool {
    name == "information_schema" || name.starts_with("pg_")
}

// ── Endpoint handlers ──────────────────────────────────────────────────────────

pub struct Api;

#[derive(ApiResponse)]
enum SchemasResponse {
    #[oai(status = 200)]
    Ok(Json<SchemaList>),
}

#[derive(ApiResponse)]
enum TablesResponse {
    #[oai(status = 200)]
    Ok(Json<TableList>),
}

#[derive(ApiResponse)]
enum ColumnsResponse {
    #[oai(status = 200)]
    Ok(Json<ColumnList>),
}

#[derive(ApiResponse)]
enum DbQueryApiResponse {
    #[oai(status = 200)]
    Ok(Json<QueryResponse>),
}

async fn common_auth_and_pool(
    services: &Services,
    auth: &RequestAuthorization,
    target_name: &str,
) -> Result<(String, Uuid, Target, TargetPool), DbError> {
    if !validate_target_name(target_name) {
        return Err(DbError::bad_request("Invalid target name"));
    }
    let username =
        extract_username(Some(auth)).ok_or_else(|| DbError::unauthorized("Not authenticated"))?;
    let (user_id, target) = resolve_and_authorize(services, &username, target_name).await?;

    if let Err(e) = services.sql_console_rate_limiter.check(user_id, target.id) {
        metrics::counter!(
            "gated_rate_limit_rejected_total",
            "endpoint" => "sql_console",
        )
        .increment(1);
        warn!(
            %username,
            target = %target.name,
            scope = e.scope(),
            "sql_console_rate_limit_exceeded"
        );
        return Err(DbError::rate_limited(e.retry_after_seconds()));
    }

    let pool = services
        .db_pool_registry
        .get_or_create(&target)
        .await
        .map_err(DbError::bad_gateway)?;
    Ok((username, user_id, target, pool))
}

#[OpenApi]
impl Api {
    #[oai(
        path = "/db/schemas/:target_name",
        method = "get",
        operation_id = "get_db_schemas",
        transform = "endpoint_auth"
    )]
    async fn api_db_schemas(
        &self,
        target_name: Path<String>,
        services: Data<&Services>,
        auth: Data<&RequestAuthorization>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<SchemasResponse, DbError> {
        let target_name = target_name.0;
        let (_username, _user_id, target, pool) =
            common_auth_and_pool(&services, *auth, &target_name).await?;

        let (kind, default_schema) = match &target.options {
            TargetOptions::MySql(o) => ("MySql", o.default_database_name.clone()),
            TargetOptions::Postgres(o) => ("Postgres", o.default_database_name.clone()),
            _ => unreachable!(),
        };

        let schemas = match &pool {
            TargetPool::MySql(pool) => {
                // `SHOW DATABASES` (and some info_schema columns) come back as
                // VARBINARY on servers where `collation_connection` resolves to
                // a binary collation. sqlx's `String` decoder refuses that, so
                // we read bytes and lossily convert.
                let rows = sqlx::query_scalar::<_, Vec<u8>>("SHOW DATABASES")
                    .fetch_all(pool)
                    .await
                    .map_err(|e| {
                        warn!(target = %target.name, error = %e, "list MySQL schemas failed");
                        DbError::bad_gateway(format!("list schemas: {e}"))
                    })?;
                let mut v: Vec<String> = rows
                    .into_iter()
                    .map(|b| String::from_utf8_lossy(&b).into_owned())
                    .filter(|s| !is_system_schema_mysql(s))
                    .collect();
                v.sort();
                v
            }
            TargetPool::Postgres(pool) => {
                let rows = sqlx::query_scalar::<_, String>(
                    "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
                )
                .fetch_all(pool)
                .await
                .map_err(|e| {
                    warn!(target = %target.name, error = %e, "list Postgres schemas failed");
                    DbError::bad_gateway(format!("list schemas: {e}"))
                })?;
                rows.into_iter()
                    .filter(|s| !is_system_schema_postgres(s))
                    .collect()
            }
        };

        Ok(SchemasResponse::Ok(Json(SchemaList {
            schemas,
            default_schema,
            readonly: target_readonly(&target),
            kind: kind.to_string(),
        })))
    }

    #[oai(
        path = "/db/tables/:target_name",
        method = "get",
        operation_id = "get_db_tables",
        transform = "endpoint_auth"
    )]
    async fn api_db_tables(
        &self,
        target_name: Path<String>,
        schema: Query<Option<String>>,
        services: Data<&Services>,
        auth: Data<&RequestAuthorization>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<TablesResponse, DbError> {
        let target_name = target_name.0;
        let (_username, _user_id, _target, pool) =
            common_auth_and_pool(&services, *auth, &target_name).await?;
        let schema = match schema.0 {
            Some(s) if !s.is_empty() => s,
            _ => return Err(DbError::bad_request("schema query param required")),
        };

        let tables: Vec<TableInfo> = match &pool {
            TargetPool::MySql(pool) => {
                // Same VARBINARY-vs-String story as schemas; decode as bytes.
                sqlx::query_as::<_, (Vec<u8>, Vec<u8>)>(
                    "SELECT table_name, table_type \
                     FROM information_schema.tables \
                     WHERE table_schema = ? \
                     ORDER BY table_name",
                )
                .bind(&schema)
                .fetch_all(pool)
                .await
                .map_err(|e| {
                    warn!(target = %target_name, error = %e, "list MySQL tables failed");
                    DbError::bad_gateway(format!("list tables: {e}"))
                })?
                .into_iter()
                .map(|(name, kind)| TableInfo {
                    name: String::from_utf8_lossy(&name).into_owned(),
                    kind: String::from_utf8_lossy(&kind).into_owned(),
                })
                .collect()
            }
            TargetPool::Postgres(pool) => sqlx::query_as::<_, (String, String)>(
                "SELECT table_name, table_type \
                 FROM information_schema.tables \
                 WHERE table_schema = $1 \
                 ORDER BY table_name",
            )
            .bind(&schema)
            .fetch_all(pool)
            .await
            .map_err(|e| DbError::bad_gateway(format!("list tables: {e}")))?
            .into_iter()
            .map(|(name, kind)| TableInfo { name, kind })
            .collect(),
        };

        Ok(TablesResponse::Ok(Json(TableList { tables })))
    }

    #[oai(
        path = "/db/columns/:target_name",
        method = "get",
        operation_id = "get_db_columns",
        transform = "endpoint_auth"
    )]
    async fn api_db_columns(
        &self,
        target_name: Path<String>,
        schema: Query<String>,
        table: Query<String>,
        services: Data<&Services>,
        auth: Data<&RequestAuthorization>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<ColumnsResponse, DbError> {
        let target_name = target_name.0;
        let (_username, _user_id, _target, pool) =
            common_auth_and_pool(&services, *auth, &target_name).await?;
        if schema.is_empty() || table.is_empty() {
            return Err(DbError::bad_request("schema and table required"));
        }

        let cols: Vec<ColumnInfo> = match &pool {
            TargetPool::MySql(pool) => sqlx::query_as::<_, (Vec<u8>, Vec<u8>, Vec<u8>, Vec<u8>)>(
                "SELECT column_name, column_type, is_nullable, column_key \
                 FROM information_schema.columns \
                 WHERE table_schema = ? AND table_name = ? \
                 ORDER BY ordinal_position",
            )
            .bind(&schema.0)
            .bind(&table.0)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                warn!(target = %target_name, error = %e, "list MySQL columns failed");
                DbError::bad_gateway(format!("list columns: {e}"))
            })?
            .into_iter()
            .map(|(name, data_type, nullable, col_key)| ColumnInfo {
                name: String::from_utf8_lossy(&name).into_owned(),
                data_type: String::from_utf8_lossy(&data_type).into_owned(),
                nullable: String::from_utf8_lossy(&nullable).eq_ignore_ascii_case("YES"),
                primary_key: &col_key[..] == b"PRI",
            })
            .collect(),
            TargetPool::Postgres(pool) => {
                sqlx::query_as::<_, (String, String, String, Option<String>)>(
                    "SELECT c.column_name, c.data_type, c.is_nullable, kc.constraint_type \
                     FROM information_schema.columns c \
                     LEFT JOIN information_schema.key_column_usage k \
                         ON k.table_schema = c.table_schema \
                        AND k.table_name = c.table_name \
                        AND k.column_name = c.column_name \
                     LEFT JOIN information_schema.table_constraints kc \
                         ON kc.constraint_name = k.constraint_name \
                        AND kc.table_schema = k.table_schema \
                        AND kc.constraint_type = 'PRIMARY KEY' \
                     WHERE c.table_schema = $1 AND c.table_name = $2 \
                     ORDER BY c.ordinal_position",
                )
                .bind(&schema.0)
                .bind(&table.0)
                .fetch_all(pool)
                .await
                .map_err(|e| DbError::bad_gateway(format!("list columns: {e}")))?
                .into_iter()
                .map(|(name, data_type, nullable, kc)| ColumnInfo {
                    name,
                    data_type,
                    nullable: nullable.eq_ignore_ascii_case("YES"),
                    primary_key: kc.is_some(),
                })
                .collect()
            }
        };

        Ok(ColumnsResponse::Ok(Json(ColumnList { columns: cols })))
    }

    #[oai(
        path = "/db/query/:target_name",
        method = "post",
        operation_id = "run_db_query",
        transform = "endpoint_auth"
    )]
    async fn api_db_query(
        &self,
        target_name: Path<String>,
        body: Json<QueryRequest>,
        services: Data<&Services>,
        auth: Data<&RequestAuthorization>,
        _sec_scheme: AnySecurityScheme,
    ) -> Result<DbQueryApiResponse, DbError> {
        let target_name = target_name.0;
        let (username, _user_id, target, pool) =
            common_auth_and_pool(&services, *auth, &target_name).await?;

        let sql = body.0.sql.trim().to_string();
        if sql.is_empty() {
            return Err(DbError::bad_request("sql is empty"));
        }
        let console_session_key = body.0.console_session_key.clone();
        let requested_limit = body.0.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let readonly = target_readonly(&target);
        let statement_kind = classify_sql(&sql);
        let session_id = console_session_key
            .as_ref()
            .map(|key| sql_console_session_id_from_key(key))
            .unwrap_or_else(Uuid::new_v4);
        let recording_name = "sql-console";
        ensure_sql_console_group_session(&services, session_id, &username, &target).await?;

        if readonly {
            if let Err(violation) = super::sql_validation::validate_readonly_sql(&sql) {
                record_sql_console_request(
                    &services,
                    session_id,
                    recording_name,
                    &target,
                    &sql,
                    statement_kind,
                    readonly,
                    0,
                    false,
                    Some(violation.to_string()),
                )
                .await?;
                warn!(
                    %username,
                    target = %target.name,
                    kind = %statement_kind,
                    violation = %violation,
                    "sql_console_readonly_violation"
                );
                return Err(DbError::forbidden(violation.to_string()));
            }
        }

        let sql_hash = {
            let mut h = Sha256::new();
            h.update(sql.as_bytes());
            hex::encode(h.finalize())
        };
        let started = Instant::now();

        let result = match &pool {
            TargetPool::MySql(pool) => {
                run_mysql_query(pool, &sql, requested_limit, statement_kind).await
            }
            TargetPool::Postgres(pool) => {
                run_postgres_query(pool, &sql, requested_limit, statement_kind).await
            }
        };

        let elapsed = started.elapsed();

        let duration_secs = elapsed.as_secs_f64();
        metrics::histogram!(
            "gated_db_query_duration_seconds",
            "target" => target.name.clone(),
        )
        .record(duration_secs);

        match result {
            Ok(out) => {
                record_sql_console_request(
                    &services,
                    session_id,
                    recording_name,
                    &target,
                    &sql,
                    statement_kind,
                    readonly,
                    elapsed.as_millis() as u64,
                    true,
                    None,
                )
                .await?;
                metrics::counter!(
                    "gated_db_query_total",
                    "target" => target.name.clone(),
                    "result" => "ok",
                )
                .increment(1);
                let resp = QueryResponse {
                    columns: out.columns,
                    rows: out.rows,
                    rows_affected: out.rows_affected,
                    truncated: out.truncated,
                    elapsed_ms: elapsed.as_millis() as u64,
                    limit: requested_limit,
                    statement_kind: statement_kind.to_string(),
                };
                info!(
                    %session_id,
                    %username,
                    target = %target.name,
                    kind = %statement_kind,
                    sql_hash = %sql_hash,
                    rows = resp.rows.len(),
                    truncated = resp.truncated,
                    duration_ms = elapsed.as_millis() as u64,
                    "sql_console_query"
                );
                Ok(DbQueryApiResponse::Ok(Json(resp)))
            }
            Err(e) => {
                record_sql_console_request(
                    &services,
                    session_id,
                    recording_name,
                    &target,
                    &sql,
                    statement_kind,
                    readonly,
                    elapsed.as_millis() as u64,
                    false,
                    Some(e.clone()),
                )
                .await?;
                metrics::counter!(
                    "gated_db_query_total",
                    "target" => target.name.clone(),
                    "result" => "error",
                )
                .increment(1);
                warn!(
                    %session_id,
                    %username,
                    target = %target.name,
                    kind = %statement_kind,
                    sql_hash = %sql_hash,
                    error = %e,
                    duration_ms = elapsed.as_millis() as u64,
                    "sql_console_query_failed"
                );
                Err(DbError::bad_request(e))
            }
        }
    }
}

fn is_row_producing(kind: &str) -> bool {
    matches!(kind, "SELECT" | "SHOW" | "EXPLAIN" | "DESCRIBE")
}

async fn run_mysql_query(
    pool: &MySqlPool,
    sql: &str,
    limit: i64,
    statement_kind: &str,
) -> Result<QueryResultBody, String> {
    let mut conn = pool.acquire().await.map_err(|e| format!("acquire: {e}"))?;

    let timeout_ms = STATEMENT_TIMEOUT.as_millis() as u64;
    // Best-effort: MAX_EXECUTION_TIME is a SELECT-only hint from 5.7+.
    let _ = sqlx::query(&format!("SET SESSION MAX_EXECUTION_TIME = {timeout_ms}"))
        .execute(&mut *conn)
        .await;

    if is_row_producing(statement_kind) {
        tokio::time::timeout(
            STATEMENT_TIMEOUT + Duration::from_secs(5),
            fetch_mysql_rows(&mut conn, sql, limit),
        )
        .await
        .map_err(|_| "statement timed out".to_string())?
    } else {
        let res = tokio::time::timeout(
            STATEMENT_TIMEOUT + Duration::from_secs(5),
            sqlx::query(sql).execute(&mut *conn),
        )
        .await
        .map_err(|_| "statement timed out".to_string())?
        .map_err(|e| format!("execute: {e}"))?;
        Ok(QueryResultBody {
            columns: vec![],
            rows: vec![],
            rows_affected: Some(res.rows_affected()),
            truncated: false,
        })
    }
}

async fn fetch_mysql_rows(
    conn: &mut sqlx::pool::PoolConnection<sqlx::MySql>,
    sql: &str,
    limit: i64,
) -> Result<QueryResultBody, String> {
    use futures::StreamExt;

    let mut stream = sqlx::query(sql).fetch(&mut **conn);
    let mut columns: Vec<QueryColumn> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut total_bytes: usize = 0;
    let mut truncated = false;

    while let Some(row_res) = stream.next().await {
        let row = row_res.map_err(|e| format!("fetch: {e}"))?;
        if columns.is_empty() {
            for c in row.columns() {
                columns.push(QueryColumn {
                    name: c.name().to_string(),
                    type_name: c.type_info().name().to_string(),
                });
            }
        }
        let cells: Vec<serde_json::Value> = row
            .columns()
            .iter()
            .map(|c| decode_mysql_value(&row, c))
            .collect();
        total_bytes += approx_row_size(&cells);
        rows.push(cells);
        if rows.len() as i64 >= limit || total_bytes > MAX_RESULT_BYTES {
            truncated = true;
            break;
        }
    }

    Ok(QueryResultBody {
        columns,
        rows,
        rows_affected: None,
        truncated,
    })
}

async fn run_postgres_query(
    pool: &PgPool,
    sql: &str,
    limit: i64,
    statement_kind: &str,
) -> Result<QueryResultBody, String> {
    let mut conn = pool.acquire().await.map_err(|e| format!("acquire: {e}"))?;

    let timeout_ms = STATEMENT_TIMEOUT.as_millis() as u64;
    let _ = sqlx::query(&format!("SET statement_timeout = {timeout_ms}"))
        .execute(&mut *conn)
        .await;

    if is_row_producing(statement_kind) {
        tokio::time::timeout(
            STATEMENT_TIMEOUT + Duration::from_secs(5),
            fetch_pg_rows(&mut conn, sql, limit),
        )
        .await
        .map_err(|_| "statement timed out".to_string())?
    } else {
        let res = tokio::time::timeout(
            STATEMENT_TIMEOUT + Duration::from_secs(5),
            sqlx::query(sql).execute(&mut *conn),
        )
        .await
        .map_err(|_| "statement timed out".to_string())?
        .map_err(|e| format!("execute: {e}"))?;
        Ok(QueryResultBody {
            columns: vec![],
            rows: vec![],
            rows_affected: Some(res.rows_affected()),
            truncated: false,
        })
    }
}

async fn fetch_pg_rows(
    conn: &mut sqlx::pool::PoolConnection<sqlx::Postgres>,
    sql: &str,
    limit: i64,
) -> Result<QueryResultBody, String> {
    use futures::StreamExt;

    let mut stream = sqlx::query(sql).fetch(&mut **conn);
    let mut columns: Vec<QueryColumn> = Vec::new();
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut total_bytes: usize = 0;
    let mut truncated = false;

    while let Some(row_res) = stream.next().await {
        let row = row_res.map_err(|e| format!("fetch: {e}"))?;
        if columns.is_empty() {
            for c in row.columns() {
                columns.push(QueryColumn {
                    name: c.name().to_string(),
                    type_name: c.type_info().name().to_string(),
                });
            }
        }
        let cells: Vec<serde_json::Value> = row
            .columns()
            .iter()
            .map(|c| decode_postgres_value(&row, c))
            .collect();
        total_bytes += approx_row_size(&cells);
        rows.push(cells);
        if rows.len() as i64 >= limit || total_bytes > MAX_RESULT_BYTES {
            truncated = true;
            break;
        }
    }

    Ok(QueryResultBody {
        columns,
        rows,
        rows_affected: None,
        truncated,
    })
}

fn approx_row_size(cells: &[serde_json::Value]) -> usize {
    cells
        .iter()
        .map(|v| match v {
            serde_json::Value::Null => 4,
            serde_json::Value::Bool(_) => 5,
            serde_json::Value::Number(_) => 16,
            serde_json::Value::String(s) => s.len() + 2,
            other => serde_json::to_string(other).map(|s| s.len()).unwrap_or(32),
        })
        .sum::<usize>()
        + 16 // per-row overhead
}
