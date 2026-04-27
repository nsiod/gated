# INFRA-003 CI 质量门扩展

- **status**: completed
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## Outcome

New `quality` job in `.github/workflows/test.yml` runs in parallel
with `test` / `frontend`:

- `just clippy` (cargo-cranky, per-crate, --all-features).
- `cargo machete --with-metadata` — stable-toolchain alternative to
  `cargo-udeps`.
- `cargo deny check advisories bans sources licenses` against the
  existing repo-root `deny.toml`.
- `cd crates/gated-web && bun run test` (Vitest, from TEST-001).
- `cd crates/gated-web && bun run i18n-check` (from I18N-001).

Tools are cached under `~/.cargo/bin` via the existing cache pattern;
`target/` is cached with a `cargo-quality-` key so the clippy + deny
passes don't invalidate the `test` job cache.

## Pre-existing blockers fixed

- `crates/gated-protocol-http/src/api/db_terminal.rs`: `buf[..n]` now
  carries a scoped `#[allow(clippy::indexing_slicing, reason = "n
  bounded by Read::read contract")]`. The `n <= buf.len()` invariant
  is from `Read::read`'s contract; rewriting with `.get(..n)` would
  silently drop bytes on contract violation and adds a per-chunk
  bounds check for no benefit.
- `crates/gated-ca/Cargo.toml` + `crates/gated-protocol-http/Cargo.toml`:
  `hex` needed the `alloc` feature on per-crate `cargo cranky`. In
  whole-workspace builds another consumer enabled `alloc` for them;
  the per-crate clippy job didn't, so `hex::encode` failed to resolve.
- `docs/architecture.md` CI/CD section rewritten to list the 4 parallel
  jobs + the gates the `quality` job enforces.

## Local reproduction

Every gate is reproducible via `just`:
- `just clippy` — the cranky lints.
- `cargo deny check` / `cargo machete` — once installed with
  `cargo install --locked cargo-deny cargo-machete`.
- `just test-web` — Vitest.
- `just i18n-check` — key parity.
- `just cleanup` — chains fix + clippy + fmt + typecheck + lint +
  i18n-check + test-web.

## Deferred

- `cargo-udeps` on a nightly sub-job — traded for `cargo-machete`
  (stable, ~10× faster, same question in practice). Task spec
  explicitly allowed this substitution.

## Description

当前 `.github/workflows/test.yml` 主要跑 `just test` 与前端 build / tsc，缺少质量 / 安全 / 依赖层的硬门：

- 未跑 `just clippy`（含 cargo-cranky strict lints）。
- 未跑 `cargo-udeps`（未用依赖）/ `cargo deny check advisories sources`（供应链）。
- 未跑前端 `vitest run`（依赖 TEST-001）与 `i18n-check`（依赖 I18N-001）。

验收标准：
- `test.yml` 新增 job 或 step：
  - `just clippy` 所有 crate、all features。
  - `cargo udeps --workspace --all-targets`（允许 nightly 单独 job 或换 `cargo-machete`）。
  - `cargo deny check`（`deny.toml` 起步只 warn on unknown / banned）。
  - 前端 `bun run test`（TEST-001 就绪后启用）。
  - 前端 `bun run scripts/i18n-check.ts`（I18N-001 就绪后启用）。
- 新门失败必须可以在本地用 `just cleanup` / `just test` 复现。
- `docs/architecture.md` CI/CD 小节同步更新（INFRA-002 联动）。

## ActiveForm

扩展 CI 质量门：clippy / 依赖 / 前端测试

## Dependencies

- **blocked by**: TEST-001, I18N-001
- **blocks**: (none)

## Notes

如 `cargo-udeps` 需要 nightly 过重，可改 `cargo-machete`（stable，快）。
