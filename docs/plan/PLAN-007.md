# PLAN-007 项目整体 Review 与优化

## 基本信息

- **状态**: draft
- **创建时间**: 2026-04-18 20:55
- **审批时间**: (待审批)
- **关联任务**: INFRA-002 / INFRA-003 / REFACTOR-001 ~ 004 / SEC-001 ~ 003 / PERF-001 ~ 002 / OBS-001 ~ 003 / UI-025 ~ 026 / I18N-001 / TEST-001 ~ 003

## 现状

Gated 已完成核心网关协议（SSH / HTTPS / MySQL / Postgres / Kubernetes）、Admin 全量管理 UI（PLAN-005）、UI 视觉体验优化（PLAN-006）、DB Phase 1 Web Terminal（持久终端）、DB Phase 2 Web SQL Console（FEAT-001）、Admin 端签发/吊销用户 API Token（AUTH-001）等里程碑。工作区包含 18 个 Rust 子 crate + 1 个前端子 crate（共 19 个）。

通过对 `crates/`、`tests/`、`docs/` 的全面审计，发现如下跨模块共性问题，不同模块单独处理会重复、低效，适合合并到一个整体 Review 计划：

### 发现分类

1. **工作空间 / 依赖健康**
   - `docs/architecture.md:25` 写 "17 crates"，实际 19 crates（`CLAUDE.md:59` 正确）。
   - CI 未覆盖 `just clippy` 与 `cargo-udeps`；缺少 supply-chain 检查（`cargo audit` / `cargo deny`）。

2. **后端结构**
   - `crates/gated-core/src/services.rs` 中 `Services` 有 8 个 `Arc<Mutex<T>>`，`db/config/state` 这类读多写少场景用 `Mutex` 造成读路径串行化。
   - `crates/gated-protocol-http/src/api/db_query.rs:49` 使用全局 `Lazy<Mutex<HashMap<_, Pool>>>` 缓存 per-target sqlx pool，没有在目标配置变更或 idle 超时时清理。
   - Gateway 侧 `crates/gated-protocol-http/src/api/*.rs` 有 12 个端点，仅 4 个使用 `poem-openapi`，新增的 `db_query.rs`、`db_terminal.rs`、`info.rs`、`sso_provider_*.rs`、`ssh_terminal.rs` 用原始 `#[handler]`，缺 OpenAPI schema，前端 `features/gateway/lib/api-client` 手写、与 admin 自动生成客户端脱节。
   - 库 crate（`gated-ldap/gated-sso/gated-ca/gated-tls/gated-database-protocols`）均用 `anyhow`，`Cargo.toml` 声明 `thiserror` 但未在公共 API 上定义类型化错误。
   - 工程中仍有 42+ `unwrap()/expect()` 分布在非测试代码中（e.g. `db_query.rs:272`）。

3. **HTTP / API 层**
   - 新增 SQL Console / DB Terminal 没有接入 `RateLimiterRegistry`；已有协议（SSH/MySQL/Postgres）走 core 速率限制，Gateway HTTP 侧未对齐。
   - SQL readonly 判定（`db_query.rs:195`）只做前缀匹配 + 注释剥离，未防御复合语句（`;`）、服务端函数写入（`xp_cmdshell`、`pg_read_server_files`、可写 CTE 等）。
   - `/api/db/schemas/:target` 等内省端点未校验 schema/table 名字符集。

4. **前端 (crates/gated-web)**
   - Monaco Editor（`monaco-editor` + `@monaco-editor/react`）以静态导入方式加入 `sql-console.tsx`，不走 code split；对未使用 SQL Console 的用户也增加 ~100 KiB gzip。
   - `features/admin/pages/users/user-detail.tsx` 1400+ 行，`target-form.tsx` 等也偏大。
   - CLAUDE.md 宣称 "Zustand for client state"，实际源码 0 处 import。
   - 整个 `src/features/**` 无 `aria-label` / `aria-describedby` / `role`，可访问性不足。
   - `src/` 下 0 个 `*.test.ts(x)` 单元测试，只有端到端的 Bun 测试。
   - i18n 仅 en / zh-CN，未有自动校验 key parity 的脚本。

5. **集成测试 (tests/)**
   - 47 个测试：`api/` 丰富、`ssh/` 良好，`db/` 3 个、`kubernetes/` 1 个、HTTP gateway 协议的 auth/tokens/sso/targets 没有专门测试。
   - `tests/db/sql-console.test.ts` 是新加的，但没有覆盖：5 MiB 截断、30s 超时、readonly 绕过尝试、复合语句拦截。

6. **可观测性**
   - 无 `/metrics` 或 Prometheus exporter。
   - `gated healthcheck` 仅做 TCP 级别探测；不覆盖 DB/迁移/鉴权后端。
   - `db_terminal.rs` WebSocket handler 300+ 行只有 3 处 `info!`；Gateway 鉴权端点缺 structured tracing。

7. **安全**
   - 2026-03-19 changelog 记录 "49 findings (8 critical / 10 high / 14 medium / 17 low)"，但项目中无 `docs/security-audit.md` 或 issue 引用，findings 状态不可追踪。

8. **文档**
   - `docs/architecture.md` 仍为旧版本：crate 数量、DB SQL Console 架构细节、SQL Console 范围未同步。

## 方案

把上述发现拆成 20 个可独立 PR 的任务，分 4 个阶段推进。同一个 PR 内的任务尽量保持边界清晰、可单独回滚。

### Phase A — 安全与正确性（P1）

- **SEC-001 Gateway 新端点速率限制**：把 `/api/db/query/:target`、`/api/db/tables/:target`、`/api/db/terminal` 等接入 `RateLimiterRegistry`（per-user + per-target），复用 core 现成组件。
- **SEC-002 SQL 只读强化**：拦截复合语句、CTE 中的写动作、明显危险服务端函数，沿用 `sqlparser` 或手写 AST 级校验替代前缀匹配；补 unit 测试。
- **SEC-003 安全审计落盘**：在 `docs/security-audit.md` 写入 49 条 finding 的状态、责任人、优先级，列出已 fix / 未 fix，后续迭代链接任务 ID。
- **REFACTOR-002 Gateway API 统一 OpenAPI**：把 `db_query`、`db_terminal`、`info`、`sso_provider_*`、`ssh_terminal` 转为 `poem-openapi`，规范入参/出参、错误响应，接入 `just openapi` 产生 TS 客户端，逐步替换 `features/gateway/lib/api-client` 的手写部分。
- **TEST-003 SQL Console 测试补全**：`tests/db/sql-console.test.ts` 增加：只读拦截（含复合语句、注释包裹、CTE）、5 MiB 截断、30s 超时、鉴权失败、非可查 kind 目标 400 等。

### Phase B — 结构与性能（P2）

- **REFACTOR-001 Services 锁层级**：`db/config/state/config_provider/admin_token` 等读多写少字段改 `Arc<RwLock<T>>`；`admin_token` 评估 `arc-swap`；保持 API 兼容（方法签名改成 `.read().await` / `.write().await`）。
- **REFACTOR-003 类型化错误**：为库 crate（`gated-ldap`/`gated-sso`/`gated-ca`/`gated-tls`/`gated-database-protocols`）定义 `thiserror` 枚举，`anyhow` 仅保留在二进制/服务层。
- **REFACTOR-004 减少 unwrap**：清点 42+ 非测试 `unwrap/expect`，改为 `?` + 合理上下文，或 `tracing::error!` + 降级。
- **PERF-001 Monaco 按需加载**：`sql-console.tsx` 改用 React.lazy / dynamic import，拆独立 chunk；保证 xterm.js 不受影响。
- **PERF-002 sqlx Pool 生命周期**：`db_query.rs` 把 pool registry 挪到 `Services`，config reload / target 删除时 `pool.close()`；`min_idle = 0`，`max_lifetime`、`idle_timeout` 可配置。
- **OBS-001 /metrics 端点**：引入 `metrics` + `metrics-exporter-prometheus`，导出 session 数、协议连接数、SQL 查询计数/耗时、鉴权结果计数等；只对内网暴露。
- **OBS-002 深度 healthcheck**：`gated healthcheck` 新增 `--deep` 模式，检查 DB 连接、迁移版本、可写、TLS 证书是否有效、LDAP/SSO 可达（可跳过）。
- **OBS-003 Gateway 结构化 tracing**：给 `credentials.rs`、`auth.rs`、`db_terminal.rs` WebSocket 流水统一加 `tracing::instrument`，带 session_id / username / target / duration 字段。

### Phase C — 前端 / UX（P2 ~ P3）

- **UI-025 大页面拆分**：`user-detail.tsx`、`target-form.tsx`、`sql-console.tsx` 抽 tab/子组件，单文件 < 500 行。
- **UI-026 可访问性基线**：对 admin / gateway 所有 Dialog、Form、Table 补 `aria-label`、`role`、键盘聚焦环；接入 `@axe-core/react` 本地开发断言。
- **I18N-001 i18n 覆盖校验**：加 `bun run scripts/i18n-check.ts`，比较 en/zh-CN key 差异，CI 失败。
- **TEST-001 前端单元测试脚手架**：Vitest + React Testing Library，先为 `shared/components`、`hooks/`、`utils/` 补烟雾测试；`bun run test` 作为 `just cleanup` 的一环。

### Phase D — 工程与文档（P2 ~ P3）

- **INFRA-002 架构文档刷新**：同步 `docs/architecture.md` 的 crate 数量、SQL Console / DB Terminal 章节、Services 依赖图、metrics/healthcheck 新增项。
- **INFRA-003 CI 质量门**：`test.yml` 加 `just clippy`、`cargo-udeps`、`cargo deny check advisories sources`、前端 `vitest run`；保证现有构建时长可接受。
- **OBS-002 与 OBS-001** 文档和 dashboards 联动，放进 `docs/ops/`（如需）。
- **TEST-002 Gateway HTTP 集成测试**：`tests/http/` 目录覆盖 gateway 登录、API token、目标列表、SSO 重定向、info 端点；复用 `ProcessManager` 与 `AdminClient`。

## 风险

- **SEC-002 SQL AST 解析**：引入 `sqlparser` 会增加二进制大小（约 ~1 MB），需要评估；`postgres` 与 `mysql` dialect 要分别判定。
- **REFACTOR-001 锁切换**：`Services` 是全局依赖，RwLock 广播到各 crate 的 API 需要统一改动；`tokio::sync::RwLock` 无写优先级，需要评估读饥饿（按当前访问模式应可接受）。
- **REFACTOR-002 OpenAPI 迁移**：Gateway 已有前端手写客户端，需要分 PR 先生成新客户端共存，再逐步切换、删除旧代码，避免一次性大改。
- **PERF-001 Monaco 懒加载**：Vite 的 worker 配置若处理不当可能在懒加载路径下失效；需要在 Playwright 冒烟上验证。
- **OBS-001 metrics 暴露面**：需要默认绑定 loopback 或管理端口，避免在公网暴露内部计数器。
- **TEST-001 单元测试**：引入 Vitest 后需要确保其不与现有的 Bun 集成测试 runner 冲突（两者使用不同 `vite.config`、不同 tsconfig）。

## 工作量

| Phase | 任务 | 预估工时 |
|-------|------|----------|
| A 安全/正确性 | SEC-001/002/003、REFACTOR-002、TEST-003 | 14 ~ 20h |
| B 结构/性能 | REFACTOR-001/003/004、PERF-001/002、OBS-001/002/003 | 20 ~ 28h |
| C 前端/UX | UI-025/026、I18N-001、TEST-001 | 12 ~ 18h |
| D 工程/文档 | INFRA-002/003、TEST-002 | 6 ~ 10h |
| **合计** | 20 个 task | **52 ~ 76h** |

## 备选方案

- **A1 — 单一大 PR vs 分阶段**：选分阶段，4 个 phase 各自可独立合入，降低回滚成本。
- **A2 — Gateway API 迁移：全量 OpenAPI vs 仅新端点**：选全量迁移到 OpenAPI，否则手写 TS 客户端的维护成本长期累积；先只做新端点只是把问题往后推。
- **A3 — SQL readonly：白名单解析 vs 黑名单关键字**：选解析（AST）方案，关键字黑名单难以对抗注释/大小写/Unicode 变体。
- **A4 — Metrics：Prometheus pull vs OpenTelemetry push**：先 Prometheus pull（架构简单，运维现成），OTel 后续再加。

## 批注

(待审批)
