# AUTH-002 用户自助签发 / 吊销访问票据

- **status**: completed
- **priority**: P2
- **owner**: claude-code
- **createdAt**: 2026-04-23 04:32
- **claimedAt**: 2026-04-23 04:32
- **completedAt**: 2026-04-23 04:55

## Completion notes

- Backend: 新增 `crates/gated-protocol-http/src/api/tickets.rs`，提供 `GET/POST/DELETE /profile/tickets`。关键安全约束：
  - `username` 永远来自 `get_user(auth)` 返回的当前登录用户，body 里没有 username 字段，避免横向越权。
  - 创建前强制 `config_provider.authorize_target(username, target_name)` — 禁止为自己无权访问的 target 签发 ticket（403 Forbidden）。
  - 列表 / 删除都按 `username` 过滤，确保只能看到 / 吊销自己的 ticket。
  - 校验 expiry 必须在未来，`number_of_uses > 0`，trim 空 label。
- 在 `api/mod.rs` 的 tuple 中注册 `tickets::Api`。
- Frontend client: 扩展 `features/gateway/lib/api-client/index.ts`，新增 `ExistingProfileTicket` / `NewProfileTicket` / `ProfileTicketAndSecret` 类型以及 `getMyTickets` / `createMyTicket` / `deleteMyTicket` 三个方法。
- Frontend hooks: `features/gateway/api.ts` 新增 `useMyTicketsQuery` / `useCreateMyTicketMutation` / `useDeleteMyTicketMutation`，以及 `gatewayKeys.tickets`。
- UI: 新增 `features/gateway/pages/profile-tickets.tsx`。target 字段使用下拉选择，选项来源是 `useTargetsQuery()`（已按用户权限过滤），因此前端天然只能选到有权限的 target；有效期 0 天表示永不过期，可用次数 0 表示无限次；创建成功后弹出一次性 secret 对话框，支持复制。
- 路由：`app/router.tsx` 增加 `/ui/profile/tickets` 路由。
- 入口：`features/gateway/components/gateway-layout.tsx` 侧边栏 + `features/gateway/pages/profile.tsx` 安全区块按钮。
- i18n: `gateway.json` (en / zh-CN) 新增 `pages.tickets` 与 `tickets.*` 全套文案。
- Quality: `cargo fmt`/build 通过；`tsc --noEmit` 通过；受影响前端文件 eslint 无 warning；`just i18n-check` 通过。
- 说明：`cargo cranky -p gated-protocol-http` 依然会因 `db_query.rs:278` 的 `indexing_slicing` 在 SEC-001/SEC-002 之后残留的 pre-existing 错误而失败，不是本次引入的问题（见 `git log crates/gated-protocol-http/src/api/db_query.rs`）；本次 `tickets.rs` 无 clippy 警告。

## Followup

- 考虑在 target 下拉中标注 kind（ssh/mysql 等）和 group，类似 `/ui/` 首页，提升在多 target 场景下的识别度。
- 集成测试：`tests/` 下补一个端到端用例：用户登录 → 创建 ticket → 用 ticket secret 直接建立 SSH/MySQL 会话 → 消耗 uses_left → 到 0 后被 middleware 拒绝。
- 管理端应能看到所有用户创建的 ticket（当前 admin `/tickets` 列表接口已具备，但无 UI 区分 "admin 代发" 与 "用户自发"，可加一个来源字段）。

## 描述

之前 ticket（一次性 / N 次访问凭证，绑定 username+target）只有管理员可以签发。普通用户需要临时 ticket 来分享访问或走 CLI workflow 时只能去找管理员。本任务让用户能在 `/ui/profile/tickets` 自助创建：

### 验收标准

- 用户登录后能在侧边栏 / profile 页看到 "Access Tickets" 入口。
- 可创建 ticket：target 下拉（来源：`GET /targets`，本身已按 RBAC 过滤）+ 有效天数 + 可用次数 + 描述。
- 后端强制 `authorize_target`，即便前端被绕过也不能为非授权 target 签发。
- 创建成功后一次性展示 secret，可复制。
- 可列出 / 吊销自己名下的 ticket，看不到其他人的。
- 新签 ticket 可作为 `gated-ticket=<secret>` 查询参数或 `Authorization: Gated <secret>` header 通过现有 middleware 完成认证 / 消耗计数。

## ActiveForm

补齐用户侧 ticket 生命周期。

## 依赖

- 无（复用 `tickets` 表、`generate_ticket_secret`、`authorize_target`、ticket middleware）。

## 笔记

涉及文件：
- 新增：`crates/gated-protocol-http/src/api/tickets.rs`
- 修改：`crates/gated-protocol-http/src/api/mod.rs`
- 修改：`crates/gated-web/src/features/gateway/lib/api-client/index.ts`
- 修改：`crates/gated-web/src/features/gateway/api.ts`
- 新增：`crates/gated-web/src/features/gateway/pages/profile-tickets.tsx`
- 修改：`crates/gated-web/src/features/gateway/pages/profile.tsx`
- 修改：`crates/gated-web/src/features/gateway/components/gateway-layout.tsx`
- 修改：`crates/gated-web/src/app/router.tsx`
- 修改：`crates/gated-web/public/locales/{en,zh-CN}/gateway.json`
- 更新：`crates/gated-web/src/features/gateway/lib/openapi-schema.json`（由 `bun run openapi:schema:gateway` 生成）
