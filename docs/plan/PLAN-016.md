# PLAN-016 Make DB workspace targets open CLI by default

- **status**: completed
- **createdAt**: 2026-04-23 21:20
- **approvedAt**: 2026-04-23 21:22
- **relatedTask**: UI-030

## Context

The user wants database connections in the terminal workspace to open
with the CLI by default. The provided screenshot matches the asset
sidebar context menu in
`crates/gated-web/src/features/client/components/client-layout.tsx`.

Current behavior:

- Clicking a workspace asset row calls `openOrFocus(target)` with no
  explicit mode.
- Creating a new tab from the plus menu or `New connection` calls
  `forceNewTab(target)` with no explicit mode.
- Both functions resolve their fallback mode via
  `defaultModeFor(target.kind)`.
- `defaultModeFor()` currently returns `gui` for `MySql` and
  `Postgres`, so DB assets default to SQL Console.
- The explicit context-menu items already let users choose `Open SQL
  Console` or `Open Terminal (CLI)` for DB assets.

## Proposal

Change `defaultModeFor()` in
`crates/gated-web/src/features/client/components/client-layout.tsx` so
`MySql` and `Postgres` return `cli` instead of `gui`.

That keeps the change surgical:

- single behavior switch for all default-open entry points in the
  terminal workspace
- no route changes
- no menu-label changes
- explicit SQL Console action remains available

Verification plan:

1. Run focused frontend type-checking against `crates/gated-web`.
2. Run focused ESLint on the touched file if needed by repository style
   gates.

## Risks

- This changes all default-open entry points in the workspace for DB
  assets, including row click, plus-menu tab creation, and `New
  connection` when no explicit mode is passed.
- If the user intended only one entry point to change, the scope would
  need to be narrowed before implementation.

## Scope

Expected code touch:

- `crates/gated-web/src/features/client/components/client-layout.tsx`
- `docs/changelog.md`

Tracking files:

- `docs/task/UI-030.md`
- `docs/task/index.md`
- `docs/plan/PLAN-016.md`
- `docs/plan/index.md`

## Alternatives

- Change only the primary row click to open CLI.
  Smaller behavior change, but it would leave plus-menu and `New
  connection` defaults inconsistent.
- Reorder the context menu to put `Open Terminal (CLI)` first without
  changing defaults.
  That would not satisfy the request to use CLI by default.

## Annotations

- 2026-04-23 21:20: Investigated the workspace DB target open flow and
  drafted the minimal change proposal.
- 2026-04-23 21:22: Approved to switch the workspace default DB open
  mode from SQL Console to CLI.
- 2026-04-23 21:24: Implemented the default-mode switch in
  `crates/gated-web/src/features/client/components/client-layout.tsx`
  and verified it with focused frontend type-checking and ESLint.
