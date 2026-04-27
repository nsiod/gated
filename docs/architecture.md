# Gated Architecture

> Version: 0.21.1 | License: Apache-2.0

## Overview

Gated is a smart, fully transparent bastion host / access gateway written in 100% safe Rust. It proxies SSH, HTTPS, MySQL, PostgreSQL, and Kubernetes connections with centralized authentication, RBAC authorization, full session recording, and a web admin UI. It ships as a single binary with no external dependencies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust (Edition 2021) |
| Async Runtime | Tokio 1.20+ (multi-threaded) |
| Web Framework | Poem 3.1 + poem-openapi 5.1 |
| Database ORM | Sea-ORM 1.0 + sqlx 0.8 |
| SSH | russh 0.57 |
| TLS | rustls 0.23 (aws-lc-rs provider) |
| Auth | openidconnect 4.0, ldap3 0.12, totp-rs 5.0 |
| Frontend | TypeScript, React 19, Tailwind CSS 4, shadcn/ui, Vite 8 |
| Build Tool | just (task runner) |

## Workspace Structure

18 crates organized in a Cargo workspace (`cargo metadata --no-deps` is
authoritative):

```
gated/                          # Main binary & CLI entry point
gated-common/                   # Shared types, auth, config, helpers
gated-core/                     # Core runtime: state, services, recordings, rate limiting
gated-admin/                    # REST API (OpenAPI) for the admin plane
gated-web/                      # Frontend assets (React SPA, embedded via rust-embed)
gated-db-entities/              # SeaORM database models
gated-db-migrations/            # Database migrations
gated-database-protocols/       # Shared MySQL/Postgres wire protocol utilities
gated-protocol-ssh/             # SSH bastion (server + client proxy)
gated-protocol-http/            # HTTPS proxy, SQL Console, DB/SSH terminals, web gateway
gated-protocol-mysql/           # MySQL wire protocol proxy
gated-protocol-postgres/        # PostgreSQL wire protocol proxy
gated-protocol-kubernetes/      # Kubernetes API proxy
gated-protocol-api/             # Shared API/client helpers for HTTP-side gateway endpoints
gated-ldap/                     # LDAP/Active Directory integration
gated-sso/                      # OpenID Connect SSO
gated-tls/                      # TLS certificate management
gated-ca/                       # Certificate Authority (client cert issuance)
```

## Crate Dependency Graph

```
gated (binary)
├── gated-core
│   ├── gated-common
│   ├── gated-db-entities
│   ├── gated-db-migrations
│   ├── gated-ldap
│   ├── gated-sso
│   └── gated-tls
├── gated-admin
│   ├── gated-core
│   ├── gated-common
│   ├── gated-db-entities
│   ├── gated-ca
│   ├── gated-ldap
│   ├── gated-tls
│   ├── gated-protocol-ssh
│   └── gated-protocol-kubernetes
├── gated-protocol-ssh
│   ├── gated-core
│   ├── gated-common
│   └── gated-tls
├── gated-protocol-http
│   ├── gated-core
│   ├── gated-common
│   ├── gated-admin
│   ├── gated-web
│   ├── gated-protocol-api
│   └── gated-tls
├── gated-protocol-mysql
│   ├── gated-core
│   ├── gated-common
│   └── gated-database-protocols
├── gated-protocol-postgres
│   ├── gated-core
│   ├── gated-common
│   └── gated-database-protocols
└── gated-protocol-kubernetes
    ├── gated-core
    ├── gated-common
    └── gated-tls
```

## Protocol Support

| Protocol | Crate | TLS | Recording | Auth Methods |
|----------|-------|-----|-----------|-------------|
| SSH | gated-protocol-ssh | Via russh | Terminal + Traffic | Password, PubKey, TOTP |
| HTTPS | gated-protocol-http | TLS termination | Traffic | LDAP, SSO, Password, TOTP, API token |
| MySQL | gated-protocol-mysql | TLS wrapper | TCP traffic | Target credentials |
| PostgreSQL | gated-protocol-postgres | TLS wrapper | TCP traffic | Target credentials |
| Kubernetes | gated-protocol-kubernetes | HTTPS client | Request logs | Client certificates |

On top of the wire protocols, the HTTP gateway exposes web-level endpoints:

| Endpoint surface | Path prefix | Notes |
|------------------|-------------|-------|
| Admin API | `/admin/api` | OpenAPI-generated TypeScript client (`crates/gated-web/src/shared/lib/api/dist`) |
| Gateway API (user) | `/api` | API tokens (`X-Gated-Token`) and session cookies; partially OpenAPI, partially raw `#[handler]` (see REFACTOR-002) |
| SQL Console | `/api/db/{schemas,tables,columns,query}/:target` | Per-target `sqlx` pool, 30 s `statement_timeout`, 5 MiB result cap, tokenizer-backed readonly validation (`sql_validation.rs`) |
| DB Terminal | `/api/{mysql,postgres}/terminal/:target` | WebSocket bridging the gateway MySQL/Postgres listener to xterm.js |
| SSH Terminal | `/api/ssh/terminal/:target` | WebSocket bridging the gateway SSH listener to xterm.js |
| API tokens | `/admin/api/users/:id/api-tokens` | Admin-issued bearer tokens for the gateway surface |

All protocols implement the `ProtocolServer` trait:
```rust
#[async_trait]
pub trait ProtocolServer {
    async fn run(self, listen: ListenEndpoint) -> Result<()>;
}
```

## Core Services Architecture

Central dependency injection via `Services` struct (`gated-core/src/services.rs`):

```rust
pub struct Services {
    pub db: Arc<Mutex<DatabaseConnection>>,
    pub recordings: Arc<Mutex<SessionRecordings>>,
    pub config: Arc<Mutex<GatedConfig>>,
    pub state: Arc<Mutex<State>>,
    pub config_provider: Arc<Mutex<ConfigProviderEnum>>,
    pub auth_state_store: Arc<Mutex<AuthStateStore>>,
    pub admin_token: Arc<Mutex<Option<String>>>,
    pub rate_limiter_registry: Arc<Mutex<RateLimiterRegistry>>,
    pub sql_console_rate_limiter: Arc<SqlConsoleRateLimiter>,
    pub global_params: Arc<GlobalParams>,
}
```

REFACTOR-001 tracks migrating the read-heavy `Mutex` fields (`db`,
`config`, `state`, `config_provider`, `auth_state_store`) to
`Arc<RwLock<T>>` and evaluating `arc-swap` for `admin_token`.

## Authentication System

### Multi-Layered Auth Pipeline

1. **Credential Types** (`gated-common/src/auth/cred.rs`):
   - Password (Argon2 hashed)
   - PublicKey (OpenSSH format)
   - Certificate (PEM X.509)
   - TOTP (RFC 6238)
   - SSO (OAuth2/OIDC)
   - WebUserApproval (manual)

2. **Credential Policies** (`gated-common/src/auth/policy.rs`):
   - `AnySingleCredentialPolicy` - any one credential sufficient
   - `AllCredentialsPolicy` - multiple credentials required (AND)
   - `PerProtocolCredentialPolicy` - protocol-specific requirements

3. **Auth Backends**:
   - `DatabaseConfigProvider` - local database (enum_dispatch)
   - LDAP integration (`gated-ldap`) - directory auth + SSH key sync
   - SSO integration (`gated-sso`) - OpenID Connect providers

4. **AuthState** (`gated-common/src/auth/state.rs`):
   - Per-session auth progress tracking
   - Broadcast channel for state changes
   - 10-minute TTL in `AuthStateStore`

### Auth Flow

```
Client Connect -> AuthState created -> Credential validation
    -> CredentialPolicy check -> Target authorization (RBAC)
    -> Session ticket -> Protocol-specific session
```

## Database Layer

- **ORM**: Sea-ORM 1.0 with sqlx
- **Supported backends**: SQLite (default), PostgreSQL, MySQL (via feature flags)
- **Migrations**: 31 sequential migrations (`gated-db-migrations`)
- **Connection pool**: min 5, max 100, 8s timeouts

### Key Entities (22 models)

```
User, Role, Target, TargetGroup
UserRoleAssignment, TargetRoleAssignment    (RBAC junction tables)
PasswordCredential, PublicKeyCredential,
CertificateCredential, OtpCredential,
SsoCredential                               (credential storage)
Session, Recording, LogEntry                 (audit)
Ticket, ApiToken                             (access tokens)
KnownHost, LdapServer, Parameters           (config)
CertificateRevocation                        (PKI)
```

### RBAC Model

```
User --N:M--> Role --N:M--> Target
                    |
                    +--> TargetGroup --1:N--> Target
```

## Session & Recording System

### Session Lifecycle

1. `State::register_session()` - creates in DB + in-memory HashMap
2. Protocol handler manages connection proxy
3. `SessionRecordings` captures terminal (asciinema) or traffic (raw TCP)
4. Live streaming via broadcast channels (WebSocket to admin UI)
5. Auto-cleanup on session drop

### Recording Types

- **Terminal**: asciinema cast v2 format (SSH sessions)
- **Traffic**: raw TCP packet capture (MySQL/Postgres/HTTP)

## Rate Limiting

Multi-level rate limiting via `governor` library:

```
Global limits -> Per-user limits -> Per-target limits
                                        |
                                   Read/Write split
```

Supports hot-swap via `SwappableLimiterCell` when config changes.

The SQL Console and DB/Postgres terminals go through a dedicated
`SqlConsoleRateLimiter` keyed by `(user_id, target_id)` with per-user
and per-target quotas configurable at runtime via
`/admin/api/parameters` (`sql_console_rate_limit_per_user`,
`sql_console_rate_limit_per_target`; `null` = unlimited). HTTP requests
return `429` + `Retry-After: 60` on limit; terminal WebSockets send a
`rate_limited` status frame before closing.

## SQL Console (DB Phase 2)

`crates/gated-protocol-http/src/api/db_query.rs` exposes
`/api/db/{schemas,tables,columns,query}/:target` against authorized MySQL
and Postgres targets. Design notes:

- Per-target `sqlx` pool cache (`max_connections = 5`, module-level
  `Lazy<Mutex<HashMap<_, _>>>`); PERF-002 plans to move it into
  `Services` with lifecycle hooks.
- Each query runs with `statement_timeout = 30s` (Postgres) or
  `MAX_EXECUTION_TIME = 30s` hint (MySQL), plus a tokio timeout guard
  at 35 s.
- Result streams accumulate rows into JSON and truncate once the
  accumulated size crosses 5 MiB (`truncated: true` in the response).
- Readonly enforcement goes through `sql_validation.rs`
  (tokenizer-based): rejects multi-statement, writable CTE, write
  keywords anywhere in the parsed stream, and dangerous server-side
  functions (`pg_read_server_files`, `lo_import`, `xp_cmdshell`,
  `load_file`, `pg_sleep`, `benchmark`, …). Violations surface a
  specific 403 and emit a `sql_console_readonly_violation` audit log.
- Audit log line per query: `sql_console_query` with sha256 SQL hash,
  row count, truncation flag, duration.

## Web Admin Panel

- **Backend**: Poem REST API with OpenAPI 3.0 auto-generation
- **Frontend**: React 19 SPA embedded via `rust-embed`, TanStack Query for server state, Zustand for auth store, shadcn/ui + Tailwind CSS v4
- **Admin endpoints**: users, targets, roles, credentials, sessions, recordings, logs, tickets, LDAP, SSH keys, API tokens, parameters
- **Gateway endpoints** (user-facing): self-service targets, profile, credentials, API tokens, SQL Console, DB/SSH web terminals
- **Real-time**: WebSocket for session monitoring, live recording playback, DB/SSH web terminals
- **Terminal Replay**: xterm.js integration for SSH session playback

## Startup Sequence

1. Parse CLI args, load YAML config
2. Initialize rustls provider (AWS-LC)
3. Build `Services` container (DB connect, migrations, init builtins)
4. Install database logger layer
5. Spawn protocol servers concurrently (`FuturesUnordered`)
6. Start cleanup task (expired sessions/recordings)
7. Watch config file for live reload
8. Handle SIGINT/SIGTERM for graceful shutdown

## Configuration

- **Format**: YAML (`/etc/gated.yaml` default)
- **Sections**: HTTP, SSH, MySQL, PostgreSQL, Kubernetes, database, recordings, logging
- **Runtime config**: stored in database, managed via admin API
- **Live reload**: file watcher triggers config refresh

## Testing

- **Integration tests**: Bun/TypeScript in `tests/` directory
- **Coverage**: all protocols, auth methods, session recording, API endpoints
- **Infrastructure**: OIDC mock server, certificate fixtures

## CI/CD

3 GitHub Actions workflows:
- `build.yml` - Multi-platform builds (Linux x86_64/ARM64) + config schema check, triggered on tags
- `test.yml` - 4 parallel jobs: `test` (cargo test --all-features + release binary),
  `frontend` (Vite build), `quality` (clippy / cargo-deny / cargo-machete / vitest / i18n-check),
  and `integration` (Bun end-to-end, needs `test` + `frontend`). PRs also run
  `schema-compatibility` (oasdiff breaking-change check between main + PR schemas).
- `docker.yml` - Docker image builds (multi-arch), triggered on tags

### Quality gates (`quality` job, enforced on every PR)

- `just clippy` — `cargo-cranky` with the deny set in `Cranky.toml`:
  `unsafe_code`, `clippy::unwrap_used`, `clippy::expect_used`,
  `clippy::panic`, `clippy::indexing_slicing`, `clippy::dbg_macro`.
- `cargo machete --with-metadata` — unused dependency detector; stable-
  toolchain alternative to `cargo-udeps` (which needs nightly).
- `cargo deny check advisories bans sources licenses` — supply-chain
  gate driven by repo-root `deny.toml` (advisory ignore list, banned
  crates like `openssl-sys`, license allow-list).
- `bun run test` — Vitest unit tests under `crates/gated-web/src/`.
- `bun run i18n-check` — en / zh-CN key parity across `common`,
  `admin`, `gateway` namespaces.

Every gate is reproducible locally via `just cleanup` (which already
runs fix + clippy + fmt + typecheck + lint + i18n-check + test-web).

## Error handling

Library crates (`gated-ca`, `gated-ldap`, `gated-sso`, `gated-tls`,
`gated-database-protocols`) expose typed errors via `thiserror`:
`CaError`, `LdapError`, `SsoError`, `RustlsSetupError`, etc. Their
public API returns `Result<T, <CrateName>Error>` — never
`anyhow::Result`. This lets the service layer distinguish network
/ config / credential failures and map them to different HTTP
statuses + tracing levels.

Service + binary crates (`gated-common`, `gated-admin`, `gated`,
`gated-protocol-*`) aggregate typed errors into
`gated_common::GatedError`, which wraps them with `#[from]`
conversions. The HTTP response mapping lives in
`gated_common::error::GatedError::status()` and branches per
variant:

| Variant(s) | HTTP status |
|---|---|
| `InvalidTicket`, `UserNotFound`, `RoleNotFound` | 404 |
| `InvalidCredentialType`, `UrlParse`, `DeserializeJson`, `NoHostInUrl`, `ExternalHostNotWhitelisted`, `RateLimiterInvalidQuota`, `RusshKeys` | 400 |
| `SessionEnd` | 410 |
| `Reqwest` | 502 |
| DB / CA / TLS / LDAP / SSO / I/O / `Anyhow` / other | 500 |

`anyhow` is only pulled in at the binary / service edge (for
`?`-friendly error propagation inside handlers and `main`); never in
library crates. Typed-library errors that need to be surfaced as
specific HTTP status codes should be added to `GatedError` with an
explicit `#[from]` and a matching arm in `status()` — not re-wrapped
through `GatedError::Other` or `GatedError::Anyhow`, both of which
collapse to 500.

## Deployment

- **Docker**: Multi-stage build (Rust 1.93.1 + Debian), runs as non-root `gated` user
- **Binary**: Single static binary, no external dependencies
- **Health check**: built-in `gated healthcheck` command

## Security

See [`security-audit.md`](./security-audit.md) for the rolling
register of open findings, remediation status, and the process for
reporting new issues.
