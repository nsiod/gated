# Gated - Task List

> Updated: 2026-04-23

## Usage

Each task is a single line linking to its detail file. All detailed information lives in `docs/task/PREFIX-NNN.md`.

### Format

- [ ] [**PREFIX-001 Short imperative title**](PREFIX-001.md) `P1`

### Status Markers

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Pending |
| `[-]`  | In progress |
| `[x]`  | Completed |
| `[~]`  | Closed / Won't do |

### Priority: P0 (blocking) > P1 (high) > P2 (medium) > P3 (low)

### Rules

- Only update the checkbox marker; never delete the line.
- New tasks append to the end.
- See each `PREFIX-NNN.md` for full details.

---

## Tasks

- [x] [**INFRA-001 Full repository audit and documentation cleanup**](INFRA-001.md) `P1`
- [x] [**UI-002 Auth 登录流程**](UI-002.md) `P0`
- [x] [**UI-003 布局与导航**](UI-003.md) `P0`
- [x] [**UI-004 用户管理**](UI-004.md) `P1`
- [x] [**UI-005 目标管理**](UI-005.md) `P1`
- [x] [**UI-006 目标组管理**](UI-006.md) `P1`
- [x] [**UI-007 角色管理**](UI-007.md) `P1`
- [x] [**UI-008 会话管理**](UI-008.md) `P1`
- [x] [**UI-009 录制回放**](UI-009.md) `P1`
- [x] [**UI-010 日志查看**](UI-010.md) `P1`
- [x] [**UI-011 LDAP 服务器管理**](UI-011.md) `P2`
- [x] [**UI-012 SSH 密钥管理**](UI-012.md) `P2`
- [x] [**UI-013 工单管理**](UI-013.md) `P2`
- [x] [**UI-014 参数配置**](UI-014.md) `P2`
- [x] [**UI-015 Gateway 用户功能**](UI-015.md) `P2`
- [x] [**UI-016 列表/表格基础体验优化**](UI-016.md) `P1`
- [x] [**UI-017 类型徽章与文案 i18n 统一**](UI-017.md) `P1`
- [x] [**UI-018 Gateway 行操作一致性**](UI-018.md) `P1`
- [x] [**UI-019 过滤器与 PageHeader 布局对齐**](UI-019.md) `P1`
- [x] [**UI-020 面包屑与顶部 Header 信息密度**](UI-020.md) `P2`
- [x] [**UI-021 侧边栏视觉层级优化**](UI-021.md) `P2`
- [x] [**UI-022 列表批量操作**](UI-022.md) `P2`
- [x] [**UI-023 用户头像与品牌细节**](UI-023.md) `P3`
- [x] [**UI-024 统一工作台（JumpServer 风格终端）**](UI-024.md) `P1`
- [x] [**AUTH-001 管理端为用户签发/吊销 API Token**](AUTH-001.md) `P2`
- [x] [**FEAT-001 Web-based SQL GUI（DB Phase 2）**](FEAT-001.md) `P2`
- [x] [**SEC-001 Gateway 新端点速率限制**](SEC-001.md) `P1`
- [x] [**SEC-002 SQL 只读校验强化**](SEC-002.md) `P1`
- [x] [**SEC-003 安全审计发现落盘与跟踪**](SEC-003.md) `P1`
- [x] [**REFACTOR-001 Services 锁层级优化**](REFACTOR-001.md) `P2`
- [x] [**REFACTOR-002 Gateway API 统一 OpenAPI 契约**](REFACTOR-002.md) `P1`
- [x] [**REFACTOR-003 库 crate 类型化错误**](REFACTOR-003.md) `P3`
- [x] [**REFACTOR-004 减少非测试代码中的 unwrap/expect**](REFACTOR-004.md) `P3`
- [x] [**PERF-001 Monaco Editor 按需加载**](PERF-001.md) `P2`
- [x] [**PERF-002 sqlx Pool 生命周期管理**](PERF-002.md) `P2`
- [x] [**OBS-001 Prometheus /metrics 端点**](OBS-001.md) `P2`
- [x] [**OBS-002 深度 healthcheck**](OBS-002.md) `P2`
- [x] [**OBS-003 Gateway 结构化 tracing**](OBS-003.md) `P2`
- [x] [**UI-025 大页面组件拆分**](UI-025.md) `P2`
- [x] [**UI-026 可访问性基线**](UI-026.md) `P2`
- [x] [**I18N-001 i18n key 覆盖校验**](I18N-001.md) `P3`
- [x] [**TEST-001 前端单元测试脚手架**](TEST-001.md) `P2`
- [x] [**TEST-002 Gateway HTTP 集成测试**](TEST-002.md) `P2`
- [x] [**TEST-003 SQL Console 集成测试补全**](TEST-003.md) `P1`
- [x] [**INFRA-002 刷新架构与工程文档**](INFRA-002.md) `P2`
- [x] [**INFRA-003 CI 质量门扩展**](INFRA-003.md) `P2`
- [x] [**BUG-001 Fix ticket creation datetime submission**](BUG-001.md) `P1`
- [x] [**BUG-002 Fix recording detail mobile overflow**](BUG-002.md) `P1`
- [x] [**BUG-003 Fix recording detail text overflow**](BUG-003.md) `P1`
- [x] [**BUG-004 Fix admin sessions target search**](BUG-004.md) `P1`
- [x] [**BUG-005 Fix admin log message overflow**](BUG-005.md) `P1`
- [x] [**BUG-006 Fix Kubernetes upstream CA verification in gated proxy**](BUG-006.md) `P1`
- [x] [**BUG-007 Record MySQL and Postgres gateway terminal sessions**](BUG-007.md) `P1`
- [x] [**BUG-008 Record browser SQL Console and direct DB proxy sessions**](BUG-008.md) `P1`
- [x] [**UI-027 Improve gateway target list command and action layout**](UI-027.md) `P1`
- [x] [**UI-028 Make CLI terminals use a light theme in light mode**](UI-028.md) `P1`
- [x] [**UI-029 Fix light theme selection popover colors**](UI-029.md) `P1`
- [x] [**UI-030 Make DB workspace targets open CLI by default**](UI-030.md) `P1`
- [x] [**UI-031 Improve the global web error page**](UI-031.md) `P1`
- [x] [**BUG-009 Fix API target gateway list command display**](BUG-009.md) `P1`
- [x] [**AUTH-002 用户自助签发 / 吊销访问票据**](AUTH-002.md) `P2`
