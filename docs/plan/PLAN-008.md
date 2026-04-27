# PLAN-008 Fix admin sessions target search

## 基本信息

- **状态**: completed
- **创建时间**: 2026-04-23 15:05
- **审批时间**: 2026-04-23 15:06
- **完成时间**: 2026-04-23 15:10
- **关联任务**: BUG-004

## 现状

`/ui/admin` sessions 页面使用共享 `DataTable` 的前端全局过滤，而不是
后端 `?search=` 查询。当前 Target 列只在 `cell` 中渲染
`row.original.target?.name`，没有通过 `accessorKey` 或 `accessorFn`
暴露该值。

TanStack Table 的 global filter 只会匹配 accessor-backed values，因此：

- Username 等直接 accessor 的列可以被搜索到；
- 可见的 Target 名称不能被搜索到，即使用户在表格里看得到该文本。

仓库里已有 `shared/components/data-table.test.tsx` 这类轻量 Vitest 模式，
但没有覆盖 sessions 页面对 target-name 搜索的行为。

## 方案

1. 在 `crates/gated-web/src/features/admin/pages/sessions.tsx` 为 Target 列添加
   `accessorFn: row => row.target?.name ?? ''`，保持现有 cell UI 不变。
2. 添加 focused Vitest，渲染 sessions 页面并断言输入 Target 名称后只保留
   匹配行。
3. 跑前端定向验证并同步 task / plan / changelog。

## 风险

- 若误改了列定义，可能影响该列排序/过滤字符串；直接使用显示中的
  `target.name` 可把风险降到最低。
- 测试采用页面级 mock，需要保持对 admin API hooks 的 mock 范围收敛，
  避免污染其他模块。

## 工作量

小改动，预计 20 ~ 40 分钟，包括验证与文档同步。

## 备选方案

- **A1 — 在 `DataTable` 中搜索渲染后的 cell 文本**：不选。实现更脆弱，
  还会把展示层耦合进过滤逻辑。
- **A2 — 改为后端 sessions 搜索接口**：不选。超出本次 bugfix 范围，
  且当前问题已经能在前端列定义层精确修复。

## 批注

Approved by user message `processd` and proceeding with implementation.
