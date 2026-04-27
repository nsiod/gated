# INFRA-002 刷新架构与工程文档

- **status**: completed
- **priority**: P2
- **owner**: claude-code
- **createdAt**: 2026-04-18 20:55
- **bkd_issue**: 7os2cei8
- **completedAt**: 2026-04-19 04:20

## Description

`docs/architecture.md` 与实际代码有多处偏离：

- 第 25 行写 "17 crates"，实际 19 crates（`CLAUDE.md:59` 为准）。
- SQL Console / DB Terminal / API Token 等新功能未进架构图与协议矩阵。
- 未描述 per-target sqlx pool、metrics 端点（OBS-001）、深度 healthcheck（OBS-002）。
- `CLAUDE.md:76` 写 "Zustand for client state"，实际不在项目中使用（若确认不用则改文档，若打算用则另起任务）。

验收标准：
- 更新 `docs/architecture.md`：crate 数量、workspace 清单、protocol 矩阵、DB Console 章节、metrics / healthcheck 章节、Services 依赖图。
- `CLAUDE.md` 的状态管理说明与实际对齐。
- 同步 README 的功能列表（加 SQL Console、API Token 管理）。
- `docs/changelog.md` 补一条 `[docs]` 记录。

## ActiveForm

同步 architecture.md 与 CLAUDE.md 至当前代码状态

## Dependencies

- **blocked by**: (none)
- **blocks**: (none)

## Notes

PLAN-007 执行过程中每完成一个 phase，顺便更新文档对应章节。

## Completion

- `docs/architecture.md`:
  - Crate count 17 → 18 (authoritative via `cargo metadata --no-deps`).
  - Added `gated-protocol-api` to the workspace listing and to the
    dependency graph under `gated-protocol-http`.
  - Protocol Support table now shows API-token auth on the HTTPS row.
  - New "Endpoint surface" table distinguishes Admin API / Gateway API
    / SQL Console / DB Terminal / SSH Terminal / API tokens paths and
    notes the OpenAPI-vs-raw-`#[handler]` split (REFACTOR-002).
  - Updated Services snippet to match the actual struct (adds
    `admin_token` and `sql_console_rate_limiter`; drops the `// ...`
    placeholder); cross-reference to REFACTOR-001.
  - Rate Limiting section describes the SEC-001 per-user / per-target
    quotas and the 429 + Retry-After / WebSocket `rate_limited` frame
    behaviour.
  - New "SQL Console (DB Phase 2)" section covering pool cache,
    30 s / 5 MiB / tokenizer-based readonly validation, and the
    `sql_console_query` / `sql_console_readonly_violation` audit logs.
  - Web Admin Panel split into Admin / Gateway buckets and mentions
    TanStack Query + Zustand explicitly.
- `CLAUDE.md`: crate count 19 → 18.
- `README.md`: added SQL Console, web SSH/DB terminals, and API token
  features.
- `docs/changelog.md`: `[docs]` entry for 2026-04-19 04:20.

Notes: PLAN-007 originally claimed CLAUDE.md's Zustand reference was
stale. Verified it is not — `crates/gated-web/src/shared/stores/auth.ts`
uses Zustand and `crates/gated-web/package.json` declares it. Left the
claim in docs as-is.
