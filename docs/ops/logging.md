# Logging Field Dictionary

Gated emits structured `tracing` events at `INFO` / `WARN` / `ERROR` level.
Every audit-relevant event uses a stable set of fields so log pipelines
(Loki, Elastic, whatever you like) can parse it without string matching.

## Canonical fields

| Field | Type | Present on | Meaning |
|-------|------|-----------|---------|
| `username` | string | auth + credential + terminal events | Authenticated local username (not email, not remote LDAP DN) |
| `session_id` | UUID | terminal + query events | `gated_core::State::register_session` id |
| `target` | string | terminal + query events | Target name. Pre-resolution events (`*_invalid_target_name`, `*_unauthenticated`, `*_authorize_failed`) carry the raw path segment as submitted by the client; post-resolution events carry `target.name` from the database. Both use the same field name on purpose — Loki queries should work without knowing which phase emitted the line |
| `kind` | enum (`MySql`/`Postgres`) | DB events | Database dialect for SQL Console / DB terminal |
| `protocol` | string (`http`, `db_terminal`, `ssh_terminal`, …) | every audit event | Logical subsystem. Use for filtering |
| `result` | enum / free text | auth events | Outcome (`auth_login_succeeded` vs. `auth_login_rejected`) — usually encoded into the event name itself |
| `duration_ms` | u64 | session-end + query events | Wall-clock duration in milliseconds |
| `sql_hash` | hex string | `sql_console_query` | sha256 of the raw SQL — raw SQL never logged |
| `credential_id` | UUID | credential mutations | PK of the created/deleted credential row |
| `label` | string | credential creations | User-provided credential label (not a secret) |
| `reason` | string | `*_authorize_failed` | Human-readable reason surfaced to the client |
| `scope` | string | rate-limit rejections | Which limiter bucket tripped (`per_user` / `per_target`) |

## Audit event catalog

All event names below correspond to the literal message passed to the
tracing macro and can be filtered on directly.

### Gateway auth (`crates/gated-protocol-http/src/api/auth.rs`)

| Level | Event | Fields |
|-------|-------|--------|
| INFO  | `auth_login_succeeded` | `username`, `protocol` |
| WARN  | `auth_login_rejected`  | `username`, `protocol`, `next_state` |
| WARN  | `auth_otp_invalid`     | `username`, `protocol` |
| INFO  | `auth_otp_succeeded`   | `username`, `protocol` |
| INFO  | `auth_logout`          | `protocol` |

Passwords and OTP codes are never recorded in spans or events. The
`auth_login_rejected` event carries the next `AuthResult::Need(...)`
state so dashboards can tell "wrong password" from "needs OTP step".

### Self-service credentials (`credentials.rs`)

| Level | Event | Fields |
|-------|-------|--------|
| INFO  | `credential_password_changed`     | `username` |
| INFO  | `credential_public_key_added`     | `username`, `credential_id`, `label` |
| INFO  | `credential_public_key_deleted`   | `username`, `credential_id` |
| INFO  | `credential_otp_added`            | `username`, `credential_id` |
| INFO  | `credential_otp_deleted`          | `username`, `credential_id`, `remaining_otp` |
| INFO  | `credential_certificate_issued`   | `username`, `credential_id`, `label` |
| INFO  | `credential_certificate_revoked`  | `username`, `credential_id` |

### SQL Console (`db_query.rs`) — pre-existing, included for completeness

| Level | Event | Fields |
|-------|-------|--------|
| INFO  | `sql_console_query`                   | `session_id`, `username`, `target`, `kind`, `sql_hash`, `rows`, `truncated`, `duration_ms` |
| WARN  | `sql_console_query_failed`            | `session_id`, `username`, `target`, `kind`, `sql_hash`, `error`, `duration_ms` |
| WARN  | `sql_console_readonly_violation`      | `username`, `target`, `kind`, `violation` |
| WARN  | `sql_console_rate_limit_exceeded`     | `username`, `target`, `scope` |

### DB Terminal (`db_terminal.rs`)

| Level | Event | Fields |
|-------|-------|--------|
| WARN  | `db_terminal_invalid_target_name` | `target`, `kind`, `protocol` |
| WARN  | `db_terminal_unauthenticated`     | `target`, `kind`, `protocol` |
| WARN  | `db_terminal_authorize_failed`    | `username`, `target`, `kind`, `protocol`, `reason` |
| WARN  | `db_terminal_rate_limit_exceeded` | `username`, `target`, `kind`, `scope` |
| INFO  | `db_terminal_session_started`     | `session_id`, `username`, `target`, `kind`, `protocol` |
| INFO  | `db_terminal_session_ended`       | `session_id`, `username`, `target`, `kind`, `protocol`, `duration_ms` |

### SSH Terminal (`ssh_terminal.rs`)

| Level | Event | Fields |
|-------|-------|--------|
| WARN  | `ssh_terminal_unauthenticated`   | `target`, `protocol` |
| WARN  | `ssh_terminal_session_limit`     | `username`, `target`, `protocol` |
| WARN  | `ssh_terminal_authorize_failed`  | `username`, `target`, `protocol`, `reason` |
| INFO  | `ssh_terminal_session_started`   | `session_id`, `username`, `target`, `protocol` |
| INFO  | `ssh_terminal_session_ended`     | `session_id`, `username`, `target`, `protocol`, `duration_ms` |

## What is intentionally never logged

- Passwords, OTP codes, API tokens (including admin token and
  `X-Gated-Token`)
- Raw SQL (hashed as `sql_hash` instead)
- Private keys, CA private material, client-cert PEMs
- Session cookies
- Recording streams (they go through the `SessionRecordings` pipeline,
  not the tracing subscriber)

When adding new endpoints, use `tracing::instrument(skip(...))` to
explicitly exclude parameters that may hold secrets, or keep the
function uninstrumented and emit one or more explicit audit events
with hand-picked fields from this dictionary.
