# PLAN-006 UI 视觉与体验优化

## 基本信息

- **状态**: completed
- **创建时间**: 2026-04-18 09:30
- **审批时间**: 2026-04-18 10:30
- **完成时间**: 2026-04-18 11:20
- **关联任务**: UI-016 ~ UI-023

## 现状

PLAN-005 完成后，admin 与 gateway 的全部页面已经可用，但通过 Playwright 截图复盘发现以下视觉与体验问题：

### 已经识别的具体问题

1. **页面利用率低**
   - `Sessions`、`Targets`、`Users` 列表只有几行时，分页器浮在表格底部，下方留出大段空白，视觉上像页面没加载完。
   - 列表容器宽度受限，1440px 宽屏下两侧空白明显。

2. **类型徽章 / 文案不一致**
   - `crates/gated-web/src/features/admin/pages/config/targets.tsx:77,86` 与 `target-form.tsx:374` 已经接入 `targets.types.*` i18n。
   - Gateway 端 `crates/gated-web/src/features/gateway/pages/target-list.tsx` 仍然直接渲染后端枚举原值（`Ssh` / `MySql` / `Postgres`），与 admin 端不一致。
   - `target-group-detail.tsx:196` 也在 `<Badge>{row.original.options.kind}</Badge>` 中直接显示原始枚举。

3. **Gateway 行操作不一致**
   - SSH 行有 `Open Terminal` + 命令复制按钮，MySQL / Postgres 行右侧 Actions 列空白。
   - 缺少统一的 "如何连接" 提示，用户无法直接获得 mysql/psql 客户端命令。

4. **过滤器无标签**
   - `Targets` 页顶部 `all` 下拉孤立存在，未标注它是 "分组" 过滤器；同时 `Create Target` 按钮和过滤器分两行布局，PageHeader 与 Toolbar 关系不清晰。

5. **顶部 Header 信息密度低**
   - `admin-layout.tsx:160-167` 的 12px header 只有一行 `Gated Admin` 文本，浪费空间。
   - 路由配置已经预留 `breadcrumbKey` (router.tsx)，但当前没有面包屑组件渲染。

6. **空值占位符 `—` 噪声大**
   - `Sessions` 中 Target 列、`Targets` 中 Address/Group 列大量出现 `—`，影响扫读。

7. **空列表缺 EmptyState**
   - `crates/gated-web/src/shared/components/empty-state.tsx` 已存在，但 `target-groups`、`tickets`、`ssh-keys` 等空列表只显示一段灰色文字。

8. **侧边栏视觉层级单一**
   - 四个分组（Monitoring / Configuration / Security / System）只靠 separator + 灰色 label 区分，缺乏强调；当前激活项的高亮色对比度也不足。

9. **批量操作缺失**
   - 列表无 checkbox 多选，删除 / 移入分组 / 改角色等只能逐行操作。

10. **行交互弱**
    - 鼠标悬浮无高亮，点击空白区域无反应（只有 name 列是链接）。

11. **用户头像粗糙**
    - 左下角只显示 `AD` 字母方块，没有色彩或区分。

## 方案

### 范围分阶段

#### Phase A — 高性价比基础修复（P1）

- **UI-016 列表/表格基础体验**
  - 表格加 hover 高亮、整行可点击进详情；
  - 空列表统一接入 `EmptyState`，附 "创建第一个 X" 引导按钮；
  - 空值改用浅灰省略或 `–` 字符，减少噪声；
  - 分页器只在多页时显示；
  - 评估列表容器宽度（max-w 调整 / 撑满 main）。
- **UI-017 类型徽章与文案 i18n 统一**
  - Gateway 的 target-list 改用 `t('admin:targets.types.${kind}')`（或下沉到 common namespace）；
  - `target-group-detail.tsx` 的徽章同步使用 i18n；
  - 给徽章配色按类型差异化（SSH / DB / Web / API 等）。
- **UI-018 Gateway 行操作一致性**
  - mysql 行展示 `mysql -h <host> -P <port> -u <user>` 命令 + 复制；
  - postgres 行展示 `psql 'postgres://...'` 命令 + 复制；
  - kubernetes 行展示 kubeconfig 拷贝按钮；
  - 与现有 SSH 行的命令展示保持视觉一致。
- **UI-019 过滤器与 PageHeader 布局**
  - `Targets` 顶部过滤器加 "Group:" 前缀 label；
  - 把过滤器与 `Create Target` 按钮放进同一 toolbar；
  - 抽出 `<ListPageToolbar>` 共享组件，让 Users / Roles / Tickets 等列表对齐。

#### Phase B — 信息架构（P2）

- **UI-020 面包屑与 header**
  - 利用 router 的 `breadcrumbKey` 渲染面包屑组件；
  - header 增加当前用户名 + 环境（external_host）；
  - 调整 header 高度，去掉空白条。
- **UI-021 侧边栏视觉层级**
  - 分组 label 加配色或 icon；
  - 激活项使用 primary 背景 + 高对比 foreground；
  - 折叠态保留 tooltip。
- **UI-022 批量操作**
  - DataTable 引入 row selection；
  - 列表顶部出现 selected count + bulk actions（删除 / 改组 / 改角色）；
  - 后端 admin API 支持情况调研（先做前端 fan-out）。

#### Phase C — 品牌细节（P3）

- **UI-023 用户头像与品牌细节**
  - 头像背景按用户名 hash 出色；
  - 暗色模式下检查徽章/Card 阴影对比度；
  - 登录页加品牌色块；
  - 全局 spacing 微调。

### 非目标

- 不做后端 API 改动，全部在前端完成；
- 不替换 UI 框架（继续使用 base-ui + Tailwind v4 + shadcn nova preset）；
- 不引入新的状态管理库；
- 不做移动端响应式重做（已有 sidebar drawer 暂不动）。

## 风险

- **i18n key 调整可能漏译**：Phase A 涉及把 Gateway 端类型徽章下沉 i18n key，需要同步 en/zh-CN 两份 locale 文件。
- **行点击进详情**与现有 dropdown action 可能冲突，需要 stopPropagation。
- **批量操作**的后端 API 是逐资源独立的（无 batch endpoint），前端 fan-out 可能在大规模选择时出现部分失败需要处理。
- **侧边栏配色调整**需要避免与暗色模式冲突，应在两套主题下都验证。

## 工作量

| Phase | 任务 | 预估工时 |
|------|-----|---------|
| A | UI-016 ~ UI-019 | 6 ~ 8 小时（含 Playwright 验证） |
| B | UI-020 ~ UI-022 | 4 ~ 6 小时 |
| C | UI-023 | 1 ~ 2 小时 |
| 合计 | 8 个 task | 11 ~ 16 小时 |

## 备选方案

- **A1 — 一次性大改 vs 分阶段**：选择分阶段，方便每个 task 单独 PR、单独回滚。
- **A2 — 引入 shadcn DataTable v2 / TanStack Table 高级特性**：当前已有 DataTable 组件，先复用现有抽象；批量操作时再考虑升级。
- **A3 — 重新设计而非微调**：成本过高，Phase C 之外不考虑。

## 批注

(待审批)
