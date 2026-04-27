# PLAN-009 Fix admin log message overflow

- **status**: completed
- **createdAt**: 2026-04-23 15:20
- **approvedAt**: 2026-04-23 15:23
- **relatedTask**: BUG-005

## Context

The admin audit log page is implemented in
`crates/gated-web/src/features/admin/pages/log.tsx`. It renders the
Message column inside the shared `Table` primitive from
`crates/gated-web/src/shared/components/ui/table.tsx`.

The shared table cell class includes `whitespace-nowrap` by default.
The Message cell on the log page does not override that style, so long
strings keep a single line and expand the table width beyond the
viewport. The table container then falls back to horizontal scrolling.

Recent changelog entries on 2026-04-23 (`BUG-002` and `BUG-003`) fixed
similar mobile overflow issues by adding `min-w-0`, wrapping, and
word-break constraints locally instead of changing broad shared
components.

## Proposal

Apply a local style override on the `/ui/admin/log` Message column so
message text can shrink and wrap within the available width.

Planned change:

- Update the Message `TableCell` in
  `crates/gated-web/src/features/admin/pages/log.tsx` to remove the
  inherited no-wrap behavior and allow breaking long tokens. Expected
  class shape: `whitespace-normal break-all` or equivalent.

Verification:

- Run focused ESLint on the changed page file.
- Run TypeScript no-emit for `crates/gated-web`.

## Risks

- `break-all` is aggressive and can reduce readability for normal text.
  If that looks too harsh, `break-words` plus `whitespace-normal` is a
  safer fallback, but it may not wrap some very long unbroken tokens in
  all browsers.
- A shared table primitive change would affect many admin tables and is
  not appropriate for this narrow bugfix without wider regression
  review.

## Scope

Small, local frontend fix in the admin log page plus the required task,
plan, and changelog records.

## Alternatives

- Change `TableCell` globally to stop using `whitespace-nowrap`.
  Rejected for this bugfix because many existing tables rely on the
  current compact single-line behavior.
- Add truncation with tooltip. Rejected because the request is to avoid
  horizontal overflow, not to hide content.

## Annotations

- 2026-04-23 15:23: Approved by user with `proceed`.
- 2026-04-23 15:25: Implemented the local Message-cell wrapping fix and
  completed focused verification.
