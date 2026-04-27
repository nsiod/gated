# REFACTOR-004 减少非测试代码中的 unwrap/expect

- **status**: completed
- **priority**: P3
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## State of play

INFRA-003 promoted `clippy::unwrap_used`, `clippy::expect_used`,
and `clippy::panic` to the `Cranky.toml` deny set (on top of the
existing `clippy.toml::allow-unwrap-in-tests = true`). Running
`just clippy` after that already passed, which means every non-test
`.unwrap()` / `.expect()` call is either inside a `#[cfg(test)]`
module or carries a scoped `#[allow]` attribute. The count
(`grep -rn '\.unwrap()\|\.expect('` across `crates/*/src`): 47
total, 42 covered by `#[allow]` annotations, remainder inside test
modules.

## Changes

This PR closes out the annotation quality:

- Every non-test `#[allow(clippy::unwrap_used)]` / `_expect_used`
  without a justification now carries a `reason = "..."` string so
  the invariant is documented at the call site (future readers
  don't have to reconstruct the rationale).
- Fragile-looking site in
  `crates/gated-admin/src/api/ldap_servers.rs:538` — the
  `model.bind_password.clone().unwrap()` inside
  `.unwrap_or_else(...)` — wrapped in an explicit closure with a
  scoped `#[allow]` + a comment explaining the Sea-ORM `ActiveValue`
  `Set / Unchanged / NotSet` invariant that guards it.
- Removed a stale `#[allow(clippy::unwrap_used)]` on the
  `TIMEOUT` Lazy — there was never an unwrap on that line, so the
  allow was pure noise.

Touched files:
- `gated-admin/src/main.rs`, `gated-protocol-http/src/main.rs` —
  dev-only bin + static regex.
- `gated-common/src/helpers/{locks,otp,hash}.rs`,
  `gated-common/src/config_schema.rs`,
  `gated-common/src/config/mod.rs`.
- `gated-core/src/logging/{http,database}.rs`,
  `gated-core/src/auth_state_store.rs`.
- `gated-database-protocols/src/error.rs`.
- `gated-protocol-ssh/src/server/session.rs` (6 sites, bulk).
- `gated/src/main.rs`, `gated-sso/src/config.rs`.
- `gated-admin/src/api/ldap_servers.rs` (fragile site, scoped).

## Verification

- `cargo check --all-features`: clean.
- `just clippy`: 0 errors (Cranky deny-set catches any un-annotated
  unwrap / expect / panic).
- `cargo test -p gated-core -p gated-common -p gated-admin`: pass.
- `clippy.toml` unchanged — still `allow-unwrap-in-tests = true`.
- No public API signatures changed.

## Description

非测试代码中现存 42+ 处 `unwrap()/expect()`，样例包括 `crates/gated-protocol-http/src/api/db_query.rs:272` 的 `serde_json::to_vec(&ErrorBody { ... }).unwrap_or_default()` 与多个协议模块内的解析调用。这类调用在罕见路径上可能 panic，进而击穿 tokio worker。

验收标准：
- `grep -n 'unwrap\(\)\|expect(' crates/*/src/**/*.rs`（排除 `#[cfg(test)]` 与明显 `lazy_static!` 初始化）拉清单。
- 每处给出处理方案：改 `?`、改 `.ok()` 带降级、或添加 `#[allow]` 并附注释说明为什么不可能 panic。
- `clippy.toml` 保持 `allow-unwrap-in-tests = true`。
- 不破坏任何既有 API 签名。

## ActiveForm

梳理并替换非测试 unwrap/expect

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

结合 `just clippy` 的 `clippy::unwrap_used` lint 作为验证门（INFRA-003 中添加）。
