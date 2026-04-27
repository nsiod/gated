# PLAN-018 Fix API target gateway list command display

- **status**: completed
- **createdAt**: 2026-04-23 21:40
- **approvedAt**: 2026-04-23 21:43
- **relatedTask**: BUG-009

## Context

The reported issue matches the gateway targets list screenshot: the row
for an API target shows a blue `https://<external_host>` link in the
Actions column, which reads like a direct endpoint. Investigation
traced that display to
`crates/gated-web/src/features/gateway/pages/target-list.tsx`.

Current behavior:

- API and WebAdmin targets shared the same `isHttp` branch.
- That branch rendered `https://${info.external_host}` as a direct
  clickable link in the Actions column.
- Runtime routing for API proxy requests depends on the
  `X-Gated-Target` header in
  `crates/gated-protocol-http/src/catchall.rs`, so the upstream URL is
  not the user-facing call pattern.
- The frontend already has a reusable `CopyButton` component and an
  established "copy command" pattern in
  `crates/gated-web/src/features/gateway/pages/target-list.tsx`.

## Proposal

Update the gateway targets list so API rows render a copyable curl
example instead of exposing the gateway host as a direct link.

Planned code changes:

1. In `crates/gated-web/src/features/gateway/pages/target-list.tsx`,
   add a small helper that builds an API curl example using the target
   name and `info.external_host`, for example:

   ```sh
   curl -H 'X-Gated-Target: <target-name>' https://<external-host>/
   ```

2. Split the old shared HTTP branch so `Api` rows render the curl
   preview plus `CopyButton`, while `WebAdmin` rows keep the current
   direct-link behavior.
3. Add focused frontend test coverage for the API row behavior.

Verification plan:

1. Run focused frontend type-checking in `crates/gated-web`.
2. Run focused ESLint on the touched frontend file(s).
3. Run the focused test file if one is added.

## Risks

- A terse curl example may imply `GET /` semantics only; the UI should
  present it as a copy helper rather than full API documentation.
- If the user wants the curl example to include auth headers as well,
  the scope would need to expand.

## Scope

Expected code touch:

- `crates/gated-web/src/features/gateway/pages/target-list.tsx`
- `crates/gated-web/src/features/gateway/pages/target-list.test.tsx`
- `docs/changelog.md`

Tracking files:

- `docs/task/BUG-009.md`
- `docs/task/index.md`
- `docs/plan/PLAN-018.md`
- `docs/plan/index.md`

## Alternatives

- Show both upstream URL and curl example in the same cell.
  More complete, but it keeps the misleading URL visually prominent.
- Move the curl example to the detail page only.
  Smaller list-page change, but it would not address the screenshoted
  confusion in the admin list.
- Replace the Address column label entirely for API rows.
  More invasive and unnecessary for the requested bugfix.

## Annotations

- 2026-04-23 21:40: Initial investigation misread the screenshot as the
  admin list; implementation was corrected to the gateway targets list
  once the visible columns were cross-checked.
- 2026-04-23 21:43: Approved to implement the copyable curl example in
  the gateway targets list for API target rows.
- 2026-04-23 22:14: Implemented the API curl-copy action, preserved the
  WebAdmin direct link, and verified with focused Vitest, ESLint, and
  TypeScript checks.
- 2026-04-23 22:16: Follow-up approved to include the token header
  placeholder `-H 'x-gated-token: <TOKEN>'` in the API curl example.
- 2026-04-23 22:19: Updated the curl example and focused test to
  include the token placeholder header, then re-ran Vitest, ESLint,
  and TypeScript verification.
