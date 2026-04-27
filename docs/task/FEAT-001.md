# FEAT-001 Web-based SQL GUI (DB Phase 2)

- **status**: completed
- **priority**: P2
- **owner**: Roy
- **createdAt**: 2026-04-18 14:30
- **completedAt**: 2026-04-18 15:30

## 描述

Phase 1(DB CLI,浏览器内 `mysql` / `psql` PTY 终端)已落地。Phase 2 提供一个 SQL GUI 面板,类似 JumpServer `chen` / DBeaver Web,给不熟悉 CLI 的用户用。

### 验收标准

1. Gateway 目标列表的 MySQL / Postgres 行除 "Open Terminal" 外增加 "Open SQL Console" 入口。
2. SQL Console 页面包含:
   - Monaco 编辑器(SQL 语法高亮、自动补全表/列名走 `information_schema`)。
   - 左侧 schema/table 列表(懒加载)。
   - 运行按钮 + 快捷键(Ctrl/Cmd+Enter)。
   - 结果以表格展示,支持按列排序、分页(默认 LIMIT 1000)。
   - 查询历史(本会话 + 持久化到用户 profile)。
3. 查询通过后端 `/api/db/query/:target` 执行,后端用 `sqlx`(MySQL)和 `tokio-postgres` 直连目标,参数包括 `sql`、`limit`、`params`。
4. 安全与稳态:
   - 每查询单独 connection,完成后释放;连接池走 per-target,`max_connections = 5`。
   - 服务端强制 `statement_timeout = 30s`(可 per-target 覆盖)。
   - 结果大小硬上限(比如 5MB JSON);超出则截断 + 前端提示。
   - 只读开关(target-level):启用时 SQL 必须匹配 SELECT/SHOW/EXPLAIN/WITH 前缀(大小写无关),其它语句一律拒绝。
   - 每次查询写 audit log(session_id, user, target, sql hash, rows, duration)。
5. RBAC 沿用现有 `authorize_target`,不再独立 grant。
6. i18n(en/zh-CN)。

## 不在本任务范围

- 事务管理 / 多语句脚本 / DDL wizard。
- 查询取消 & 长任务进度(放 FEAT-002 followup)。
- 结果 CSV / Excel 导出(followup)。
- 非 MySQL/Postgres(Kubernetes、自定义 driver)。

## 关键设计决策(已讨论过一遍,记下免得又讨论)

- **不走 gated 的 DB proxy 层**:和 Phase 1 的 CLI 终端一致,用 target 自带的凭证直连,避免重写 proxy 的 SQL 层。审计靠后端日志 + recording,而不是协议级 inspection。
- **不做实时流式结果**:小结果直接 JSON,超 5MB 截断。避免 WebSocket + 分片 + 取消的复杂度。
- **不做客户端 SQL parser**:只读开关靠前缀匹配,简单粗暴;用户要更严可以后续加 `sqlparser-rs`。
- **编辑器**:Monaco 已是 shadcn 周边常用件,不再引 CodeMirror 造第二套。

## 风险

- `information_schema` 查询在超大库上可能慢 → 限制在 `information_schema.tables WHERE table_schema NOT IN ('mysql','performance_schema','sys','information_schema')` + 缓存。
- 只读模式靠前缀匹配可被 `-- SELECT ... ; DROP ...` 之类注释绕过。文档里明确这是"便利性防护",需要真正只读请用 DB 端的只读账号。
- Monaco 体积较大(~2MB gzipped),考虑 lazy route-level chunk。

## 参考

- JumpServer `chen`:https://github.com/jumpserver/chen
- DBeaver Web(CloudBeaver):https://github.com/dbeaver/cloudbeaver
- 前置 Phase 1:`crates/gated-protocol-http/src/api/db_terminal.rs`(提交 TBD)
