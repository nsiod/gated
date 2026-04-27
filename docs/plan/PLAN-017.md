# PLAN-017 Improve the global web error page

- **status**: completed
- **createdAt**: 2026-04-23 22:02
- **approvedAt**: 2026-04-23 22:05
- **relatedTask**: UI-031

## Context

The provided screenshot shows the stock React Router application error
screen rendered in production for a route lazy-import failure:
`TypeError: Failed to fetch dynamically imported module`.

Current behavior:

- `crates/gated-web/src/app/router.tsx` builds the entire route tree via
  `createBrowserRouter(...)` without a top-level `errorElement`.
- Route entries rely heavily on `lazy: async () => import(...)`, so
  chunk fetch failures during deploy races, cache staleness, or network
  issues bubble into the framework default screen.
- The current screen exposes raw framework text, stack-like error
  details, and no product-level recovery actions.
- The app already has shared theme tokens, button/card primitives, and
  i18n namespaces in place, so a global replacement can stay aligned
  with the current UI language.

## Proposal

Add one reusable global route error component and wire it into the
browser router as the fallback `errorElement`.

Planned shape:

- create a shared full-page error component under the web app that uses
  existing card/button primitives and product theme tokens
- show a product-level title, concise explanation, and a compact
  details section for the underlying error message
- provide recovery actions tuned for this class of failure:
  `Retry`, `Go to dashboard`, and `Back`
- add localized copy in both `en` and `zh-CN`
- keep the change global so all uncaught route-level errors stop using
  the stock framework page

Verification plan:

1. Run focused frontend type-checking in `crates/gated-web`.
2. Run focused ESLint on the touched frontend files.
3. If practical, add or update a small UI/unit test for the new error
   component message/action rendering.

## Risks

- A fully global `errorElement` will also cover non-chunk route errors,
  so the copy and actions need to remain generic enough for broader
  runtime failures.
- If the underlying issue is a stale asset manifest after deployment,
  the UI can improve recovery but cannot eliminate the root cause.
- Adding too much raw error detail would recreate the current poor UX;
  adding too little would make debugging harder.

## Scope

Expected code touch:

- `crates/gated-web/src/app/router.tsx`
- one new shared or app-level error page component
- locale files under `crates/gated-web/public/locales/{en,zh-CN}`
- optional focused test file if coverage is added
- `docs/changelog.md`

Tracking files:

- `docs/task/UI-031.md`
- `docs/task/index.md`
- `docs/plan/PLAN-017.md`
- `docs/plan/index.md`

## Alternatives

- Add `errorElement` only to selected top-level routes such as `/ui`
  and `/ui/admin`.
  This is narrower, but it leaves standalone routes like login, OTP,
  SSH terminal, and DB console paths inconsistent.
- Style the existing framework page with CSS only.
  This would not fix missing actions, localization, or control over the
  rendered error content.
- Handle only chunk-load failures with a custom boundary.
  That would solve the screenshot case but still leave other uncaught
  route errors on the stock page.

## Annotations

- 2026-04-23 22:02: Investigated the current router error flow,
  created the tracking task, and drafted the proposal for review.
- 2026-04-23 22:05: Approved to replace the stock router error screen
  with a branded global error page and recovery actions.
- 2026-04-23 22:07: Implemented the root-level route error boundary,
  added the branded error page plus localized copy, and verified the
  change with focused Vitest, TypeScript, and ESLint checks in
  `crates/gated-web`.
