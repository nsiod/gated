use chrono::{DateTime, Utc};
use gated_db_entities::Recording::RecordingKind;
use serde::{Deserialize, Serialize};

use super::writer::RecordingWriter;
use super::{Error, Recorder, Result};

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum SqlAuditSessionMetadata {
    #[serde(rename = "sql-console-session")]
    SqlConsoleSession { target_kind: String, target: String },
    #[serde(rename = "mysql-proxy-session")]
    MySqlProxySession {
        target: String,
        database: Option<String>,
    },
    #[serde(rename = "postgres-proxy-session")]
    PostgresProxySession {
        target: String,
        database: Option<String>,
    },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum SqlAuditRecordingItem {
    #[serde(rename = "sql-query")]
    Query {
        timestamp: DateTime<Utc>,
        target_kind: String,
        target: String,
        database: Option<String>,
        sql: String,
        statement_kind: String,
        readonly: Option<bool>,
        elapsed_ms: u64,
        success: bool,
        error: Option<String>,
    },
}

pub struct StructuredRecorder {
    writer: RecordingWriter,
}

impl StructuredRecorder {
    pub async fn write_item(&mut self, item: &SqlAuditRecordingItem) -> Result<()> {
        let mut serialized_item = serde_json::to_vec(item).map_err(Error::Serialization)?;
        serialized_item.push(b'\n');
        self.writer.write(&serialized_item).await?;
        Ok(())
    }
}

impl Recorder for StructuredRecorder {
    fn kind() -> RecordingKind {
        RecordingKind::Api
    }

    fn new(writer: RecordingWriter) -> Self {
        Self { writer }
    }
}
