# PLAN-011 Improve gateway target list command and action layout

- **status**: completed
- **createdAt**: 2026-04-23 15:40
- **approvedAt**: 2026-04-23 15:45
- **relatedTask**: UI-027

## Context

The reported issue is on `/ui`, implemented by `crates/gated-web/src/features/gateway/pages/target-list.tsx`.

Each row currently renders five columns and puts all interaction-heavy content into the final Actions cell:

- optional connection command preview
- copy button
- terminal launch button
- SQL console launch button for database targets

That cell uses `flex items-center justify-end gap-1`, while the command preview itself is `truncate max-w-[240px] hidden lg:inline-block`. The shared `TableCell` primitive also applies `whitespace-nowrap` by default. Combined, these choices compress the command preview first, even on wide desktop layouts, because the buttons keep their width and the command is treated as a single-line trailing chip.

## Proposal

Update the target list row layout so the command and actions have separate visual roles:

1. Keep the table structure and current route behavior.
2. Change the Actions cell content from one right-aligned row into a stacked layout:
   - first row: connection command preview with more usable width and inline copy affordance
   - second row: action buttons that wrap instead of squeezing the command
3. Override the page-level table cell whitespace rules where needed so the row can wrap cleanly without changing the shared table primitive.
4. Keep long commands on one line inside the command surface, but use local overflow handling instead of hard truncation so users can still inspect more of the command.
5. Add focused frontend coverage for the target list rendering states if the existing test harness can cover the layout branches without brittle CSS assertions.

## Risks

- Taller rows may reduce density slightly for pages with many targets.
- If command wrapping is handled incorrectly, copied command text could appear visually broken or ambiguous.
- Route links and translation keys must remain unchanged to avoid behavioral regressions.

## Scope

Expected files:

- `crates/gated-web/src/features/gateway/pages/target-list.tsx`
- optional focused test for the page rendering
- `docs/changelog.md` after implementation

No backend or API changes.

## Alternatives

- Add a dedicated Command column.
  This would improve separation further, but it is a wider structural change and risks making the table harder to scan on smaller screens.
- Replace the table with responsive cards.
  This would solve the layout problem more aggressively, but it is a larger redesign than the reported issue requires.
- Only increase the command max width.
  This is the smallest diff, but it does not solve the core compression problem because buttons and command preview still compete in the same single row.

## Annotations

- 2026-04-23 15:40: Initial proposal drafted from the reported screenshot and current page implementation.
- 2026-04-23 15:43: User requested a narrower layout change: remove the visible connection command preview, keep terminal and SQL console entry buttons adjacent, and place a copy button after the terminal button instead of showing the command inline.
- 2026-04-23 15:45: User approved the narrowed scope and specified the final button order as `Open SQL Console`, `Open Terminal`, `Copy`, with copy placed after the terminal action.
- 2026-04-23 15:47: Implemented the narrowed scope in `crates/gated-web/src/features/gateway/pages/target-list.tsx` and verified with focused eslint and TypeScript checks.
