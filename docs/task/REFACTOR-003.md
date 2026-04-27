# REFACTOR-003 库 crate 类型化错误

- **status**: completed
- **priority**: P3
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## State of play

Audit after the task was created: all five library crates named in
the AC (`gated-ldap`, `gated-sso`, `gated-ca`, `gated-tls`,
`gated-database-protocols`) already expose typed errors via
`thiserror` and no longer return `anyhow::Result`. `grep -rn
"anyhow::" crates/{gated-ldap,gated-sso,gated-ca,gated-tls,gated-
database-protocols}/src` returns zero hits. The task's premise was
stale.

What *was* missing:

1. `gated_common::GatedError` aggregates typed errors via `#[from]`
   but `ResponseError::status()` hard-coded `500` for every variant,
   so the service layer couldn't actually distinguish 400 / 404 /
   410 / 502 errors at the HTTP edge.
2. `gated-ldap/Cargo.toml` still declared `anyhow.workspace = true`
   though nothing in `src/` referenced it.
3. `docs/architecture.md` had no error-handling convention
   documented.

## Changes

- `crates/gated-common/src/error.rs` —
  `impl ResponseError for GatedError` now branches per variant:
  - 404: `InvalidTicket`, `UserNotFound`, `RoleNotFound`.
  - 400: `InvalidCredentialType`, `UrlParse`, `DeserializeJson`,
    `NoHostInUrl`, `ExternalHostNotWhitelisted`,
    `RateLimiterInvalidQuota`, `RusshKeys`.
  - 410: `SessionEnd`.
  - 502: `Reqwest`.
  - 500 (default): DB / CA / TLS / LDAP / SSO / I/O / rate limiter
    capacity / `Anyhow` / `Other` / `ExternalHostUnknown` /
    `InconsistentState` / `RcGen`.
- `crates/gated-ldap/Cargo.toml` — drop unused `anyhow` dep.
- `docs/architecture.md` — new *Error handling* section documenting
  the library-typed / service-aggregated convention + the full
  variant → status mapping table.

## Verification

- `cargo check --all-features`: clean.
- `cargo cranky --all-features` on `gated-common`, `gated-ldap`,
  `gated-sso`, `gated-ca`, `gated-tls`: clean.
- `cargo test -p gated-common`: passes.

## Deferred

- Adding `ResponseError::status` override on individual library
  errors (e.g. `LdapError::InvalidCredentials` → 401). The current
  flow is: library error → `GatedError::Ldap(_)` → 500. Splitting
  further would require variant-by-variant mapping and is beyond
  what the AC calls out — covered for now by the top-level HTTP
  layer that already surfaces 401 at the auth edge.

## Description

`gated-ldap`、`gated-sso`、`gated-ca`、`gated-tls`、`gated-database-protocols` 等库 crate 在 `Cargo.toml` 声明了 `thiserror` 但实际返回 `anyhow::Result`，使上层无法按错误类型分支（例如鉴权模块区分 "配置错误 / 网络错误 / 凭据错误" 以返回不同的 HTTP 状态码与 tracing 级别）。

验收标准：
- 每个库 crate 公共 API 返回 `Result<T, <CrateName>Error>`，`Error` 使用 `thiserror` 定义。
- 二进制 / 服务层（`gated`、`gated-admin`、`gated-protocol-*`）仍可用 `anyhow` 聚合，但至少在错误→HTTP 响应映射处按类型分支。
- 更新 `docs/architecture.md` 的 "Error handling" 约定。

## ActiveForm

为库 crate 引入 thiserror 错误类型

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

先做 `gated-ldap` 与 `gated-sso` 两个高频错误路径 crate 作为模板，其他 crate 照做。
