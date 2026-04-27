# REFACTOR-002 Gateway API 统一 OpenAPI 契约

- **status**: completed
- **priority**: P1
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **scope-note**: 2026-04-19 调研后发现实际剩余范围远小于原描述；见下方 Proposal。
- **completedAt**: 2026-04-19

## Description

`crates/gated-protocol-http/src/api/` 下 12 个端点模块，仅 `api_tokens`、`auth`、`credentials`、`targets_list` 走 `poem-openapi`。`db_query`、`db_terminal`、`info`、`sso_provider_detail`、`sso_provider_list`、`ssh_terminal` 等使用原始 `#[handler]`，导致：

- 无 OpenAPI schema，不参与 `just openapi` 自动生成。
- `crates/gated-web/src/features/gateway/lib/api-client/index.ts` 是手写 fetch 封装，与 admin 自动生成客户端风格分裂，类型容易漂移。
- 错误响应格式不统一（JSON 字段不同、状态码不一致）。

验收标准：
- 所有 gateway 端点迁移到 `poem-openapi`，`Api` trait 方法覆盖 `/api/*`，WebSocket 升级路径保留原 `#[handler]`（OpenAPI 不支持，但 URL 要记录在文档）。
- 扩展 `just openapi` 目标同时生成 gateway TS 客户端。
- 前端 `features/gateway/lib/api-client` 切换到生成的客户端，手写部分仅保留封装/辅助函数。
- 统一错误响应：`{ error: { code, message, details? } }`。
- 更新 `docs/architecture.md` 中 gateway API 描述。

## ActiveForm

把 gateway API 迁移到 poem-openapi 并重建 TS 客户端

## Dependencies

- **blocked by**: SEC-001, REFACTOR-001
- **blocks**: PERF-001

## Notes

建议分 PR：先加生成客户端（共存），前端逐页切换，最后移除旧客户端；避免一次性大改。

## Proposal (scoped down from AC)

任务文档列了 5 个 raw `#[handler]`（db_query / db_terminal / info / sso_provider_* / ssh_terminal），但实际只剩 1 个需要迁：
- **`info.rs`、`sso_provider_list.rs`、`sso_provider_detail.rs`** 已经用 `#[oai]` 接入 OpenAPI（看 `api/mod.rs::get()`）。
- **`db_terminal.rs` / `ssh_terminal.rs`** 用 WebSocket upgrade，`poem-openapi` 不支持——保留 raw `#[handler]`，在 `api/mod.rs` 文档注释里明确记录。

所以本 PR 只做 `db_query.rs` 的 4 个 REST endpoint（`/db/schemas`、`/db/tables`、`/db/columns`、`/db/query`）的 OpenAPI 化。

### 本 PR 范围
- 把 `db_query.rs` 的 `api_db_schemas` / `api_db_tables` / `api_db_columns` / `api_db_query` 从 raw `#[handler]` 转 `#[oai]`。
- 请求/响应结构体加 `#[derive(Object)]`，响应枚举加 `#[derive(ApiResponse)]`。
- 接入 `api::get()` 元组，从 `lib.rs` 的手挂 `.at(...)` 路由里移除。
- 保留现有 error body `{"error": "..."}`，不引入 `{ error: { code, message, details? } }`——这会破坏现有 SQL Console 测试和前端手写 client，属于跨 PR 的 breaking change，留给 follow-up。
- Rate-limit 响应的 `Retry-After: 60` header 保留。
- 运行 `just openapi`，验证 schema 里出现 `DbSchemaList` / `DbTableList` / `DbColumnList` / `DbQueryRequest` / `DbQueryResponse` 等类型。

### 不在本 PR（follow-up）
- **前端手写 `features/gateway/lib/api-client/index.ts` → 生成客户端切换**：当前手写版已经把 SQL Console 类型写好，要改成生成版需要同步改所有 page 组件。FE 改动面大于本次 backend 改动，分开做。
- **WebSocket endpoint 的 OpenAPI 化**：`poem-openapi` 没有 WebSocket 支持；AC 自己也写了「WebSocket 升级路径保留原 #[handler]」。
- **统一错误响应 `{ error: { code, message, details? } }`**：改 wire contract，前后端同步改。
- **`docs/architecture.md` 中 gateway API 描述更新**：INFRA-002 已经大致写了 "部分 OpenAPI / 部分 raw `#[handler]`"，等 WebSocket / 错误格式 follow-up 落地后再整理一次。

### 风险
- 编译可能因 `AnySecurityScheme` / `Data<&Services>` 在 oai handler 里的 use 要求有差异而报错。对照 `targets_list.rs` / `info.rs` 现有 pattern 写。
- OpenAPI schema 重新生成后，前端手写 client 的类型定义可能需要微调（字段名序列化变化等）。手写 client 已经 export 了 `DbSchemaList` etc.——如果生成的 schema 名称不同，前端类型 mismatch，会 surface 为 tsc 失败。这个在本 PR 前最后跑一次 `just typecheck` 验证。
