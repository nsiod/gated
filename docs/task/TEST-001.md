# TEST-001 前端单元测试脚手架

- **status**: completed
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## Outcome

- `crates/gated-web/vitest.config.ts` + `vitest.setup.ts` bootstrap
  Vitest with the `jsdom` environment, `globals: true`, and auto-
  cleanup between tests. Test discovery is scoped to `src/**` so the
  repo-root `tests/` Bun integration suite is never picked up.
- `@testing-library/jest-dom@^6` added as a dev dep; setup file
  registers its matchers via the `/vitest` subpath export.
- `crates/gated-web/src/shared/testing/i18n.tsx`: `I18nTestProvider`
  boots a stripped-down i18next (`lng: 'cimode'`) with no HTTP
  backend, so components that call `useTranslation` work without
  network access.
- `just test-web` recipe; `just cleanup` now chains through it.
- `tsconfig.json`: added `"types": ["vitest/globals"]` and
  `vitest.setup.ts` to `include` so the project type-checks cleanly.

## Coverage added (5 files, 19 tests)

- `shared/lib/utils.test.ts` — `isBlank`, `cn`
- `shared/lib/errors.test.ts` — `stringifyError` over Response /
  fetch-error shape / plain errors
- `shared/lib/shell-escape.test.ts` — `shellEscape` Unix branch
  (jsdom UA is blank → Unix path is active)
- `shared/components/empty-state.test.tsx` — default / custom title,
  empty description is elided, action slot rendered
- `shared/components/data-table.test.tsx` — header + cell render,
  empty-state slot render (via `I18nTestProvider`)

## Verification

- `bun run test`: 19/19 pass in ~2.2 s.
- `bun run check` (tsc --noEmit): clean.
- `bunx eslint` on all new files: clean.

## Deferred

- The AC mentioned a `sql-console.tsx` readonly helper — no such
  helper is currently exported or easily extractable (readonly
  enforcement lives server-side in Rust). A test will land when
  UI-025's component split pulls helpers out of
  `database-console.tsx`.
- CI wiring (`just test-web` in GitHub Actions) — covered by
  INFRA-003.

## Description

`crates/gated-web/src/` 目前没有任何 `*.test.ts(x)` 单元测试，所有验证都依赖 `tests/` 下的 Bun 端到端流程。对 hooks / utils / 表单校验这种细粒度逻辑反馈太慢。

验收标准：
- 引入 Vitest + @testing-library/react + jsdom；与现有 Bun 集成测试 runner 隔离（独立 `vitest.config.ts`）。
- 给至少以下目标补烟雾测试：
  - `shared/utils/*`（表单校验、格式化）
  - `shared/components/empty-state.tsx`、`data-table.tsx`（render smoke）
  - `features/gateway/pages/sql-console.tsx` 中 readonly 校验相关 helper（TEST-003 前置）
- `just test` 或 `bun run test` 纳入 `just cleanup`。
- CI（INFRA-003）运行。

## ActiveForm

搭建前端 Vitest 单元测试体系

## Dependencies

- **blocked by**: (none)
- **blocks**: UI-025, INFRA-003

## Notes

与 Bun 集成测试 runner 不同；tsconfig / jsx 配置分离避免相互影响。
