# PERF-001 Monaco Editor 按需加载

- **status**: completed
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## Outcome

- New `shared/components/sql-editor.tsx` holds all Monaco runtime
  imports (`@monaco-editor/react`, `monaco-editor`, `monaco-setup`
  side-effect). `database-console.tsx` consumes it via
  `React.lazy(() => import('./sql-editor'))` inside `<Suspense>`.
- `dist/.vite/manifest.json`: `sql-editor.tsx` is now purely a
  dynamic import of the entry; `editor.api2` is no longer in the
  entry's static `imports` list, and no `<link rel="modulepreload">`
  preloads it.
- Main bundle `index.js`: 953 KB → 838 KB (gzip 267.84 KB →
  239.28 KB, **−28 KB gzip**). Main bundle has zero `monaco-editor`
  string references (`strings | grep -c monaco-editor == 0`).
- Lazy chunk: `sql-editor-*.js` 110 KB (gzip 27 KB) +
  `editor.api2-*.js` 3.6 MB (gzip 926 KB) — fetched on first
  DatabaseConsole mount.

## Verification notes

- `bun run check` (tsc --noEmit) clean on changed files.
- `bunx eslint src/shared/components/{sql-editor,database-console}.tsx`
  clean.
- Playwright smoke: no Playwright setup in repo (TEST-001 still
  pending). Manual check: load `/ui/db/mysql/:name/console`, confirm
  the network tab fetches `sql-editor-*.js` + `editor.api2-*.js` only
  after entering that route.

## Description

`crates/gated-web/src/features/gateway/pages/sql-console.tsx` 与 `monaco-setup.ts` 通过静态 `import` 引入 `monaco-editor` + `@monaco-editor/react`，即使未打开 SQL Console 的用户也会下载整个 editor（约 100 KiB gzip 主包增量，workers 更大）。

验收标准：
- `sql-console.tsx` 用 `React.lazy` + `<Suspense>` 包裹，Monaco 相关 import 只在 SQL Console 路由被打开时触发。
- Vite 产出独立 chunk（命名清晰，便于分析）。
- 构建产物 manifest 对比：主入口 JS 回落到接入 Monaco 前水平。
- Playwright 冒烟：首次进入 `/ui/db/:kind/:targetName/console` 能成功加载 editor 并可执行 Run。

## ActiveForm

把 Monaco Editor 拆成独立动态 chunk

## Dependencies

- **blocked by**: REFACTOR-002
- **blocks**: (none)

## Notes

注意 Vite 的 `?worker` import 与懒加载的配合（workers 需预先注册到 `monaco-editor` 的 `MonacoEnvironment`）。
