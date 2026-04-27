# AUTH-001 管理端为用户签发/吊销 API Token

- **status**: completed
- **priority**: P2
- **owner**: claude-code
- **createdAt**: 2026-04-18 11:40
- **claimedAt**: 2026-04-18 11:40
- **completedAt**: 2026-04-18 11:50

## Completion notes

- Backend: 新增 `crates/gated-admin/src/api/api_tokens.rs`，提供 `GET/POST/DELETE /users/{user_id}/api-tokens`。复用已有 `api_tokens` 表与 `x-gated-token` 校验逻辑；POST 返回一次性 `secret`；校验 `expiry > now()` 与非空 `label`。在 `api::mod` 中注册 `ListApi`、`DetailApi`。
- Frontend client: 扩展 `features/admin/lib/api-client/dist/index.ts`，新增 `ExistingApiToken` / `NewApiToken` / `ApiTokenAndSecret` 类型以及 `getUserApiTokens` / `createUserApiToken` / `deleteUserApiToken` 方法。
- Frontend hooks: `features/admin/api.ts` 增加 `useUserApiTokens` / `useCreateUserApiToken` / `useDeleteUserApiToken`，以及 query key `adminKeys.userApiTokens`。
- UI: `features/admin/pages/config/user-detail.tsx` 新增 `ApiTokensTab`，放在凭证 Tabs 中 SSO 与 Roles 之间。列表显示 label / 创建时间 / 到期时间，到期的 token 显红色 badge；创建对话框接收 label + expiryDays（1–365）；签发后弹出 "仅显示一次" 的 secret 对话框，支持复制；吊销走 `ConfirmDialog`。
- i18n: `admin.json` (en / zh-CN) 添加 `users.credentials.apiTokens` 标签与 `users.credentials.apiToken.*` 全套文案。
- Quality: `cargo cranky -p gated-admin` 通过，`bunx tsc --noEmit` 通过，受影响文件 eslint 无 error/warning。
- 说明：Gateway 侧用户自助页面（`/ui/profile/api-tokens`）此前已存在，本次仅补齐管理员视角。

## Followup

- 集成测试：`tests/api/` 目前无 token 子目录，可后续补一个覆盖 admin 创建 → bearer 认证 → 吊销 的端到端测试。
- OpenAPI TS 客户端目前为手工维护（dist/index.ts），`openapi-generator-cli` 生成链依赖 Java；等 CI 环境装好 Java 后可切换回生成流程，避免双轨维护。

## 描述

管理员需要能在用户详情页代表某个用户签发临时 API Token，用于程序化访问 Gated API，并且可以指定到期时间、随时吊销。

### 验收标准

- 管理员可在 `/ui/admin/config/users/:id` 看到 "API Tokens" Tab。
- 可创建 Token：填入 label + 有效天数（1–365）；服务端写入 `api_tokens` 表，expiry 按天数换算为绝对时间。
- 新建成功后弹窗一次性展示 secret，列表中仅展示 label/创建/到期，不再展示 secret。
- 可吊销 Token（DELETE）。
- 签发的 Token 可作为 `x-gated-token` 请求头通过现有 `validate_api_token` 校验，到期后自动失效（已由现有逻辑保证）。
- i18n 英文 / 中文齐全。

## ActiveForm

补齐管理员侧 API Token 生命周期。

## 依赖

- 无（复用已有 `ApiToken` 实体、`x-gated-token` header 校验逻辑、Gateway 侧 `/profile/api-tokens` 同名 secret 生成）。

## 笔记

涉及文件：
- 新增：`crates/gated-admin/src/api/api_tokens.rs`
- 修改：`crates/gated-admin/src/api/mod.rs`
- 修改：`crates/gated-web/src/features/admin/lib/api-client/dist/index.ts`
- 修改：`crates/gated-web/src/features/admin/api.ts`
- 修改：`crates/gated-web/src/features/admin/pages/config/user-detail.tsx`
- 修改：`crates/gated-web/public/locales/{en,zh-CN}/admin.json`
