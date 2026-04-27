# PLAN-015 Fix light theme selection popover colors

- **status**: completed
- **createdAt**: 2026-04-23 16:40
- **approvedAt**: 2026-04-23 16:42
- **relatedTask**: UI-029

## Context

The shared popup primitives used by the web UI forced a `dark` class on
popup content in:

- `crates/gated-web/src/shared/components/ui/select.tsx`
- `crates/gated-web/src/shared/components/ui/dropdown-menu.tsx`
- `crates/gated-web/src/shared/components/ui/context-menu.tsx`

That caused semantic tokens such as `bg-popover` and
`text-popover-foreground` to resolve against dark mode even when the
page itself was in light mode.

## Proposal

Remove the forced `dark` class from the shared popup primitives so popup
surfaces follow the active resolved theme, and verify the touched files
with focused frontend linting and type-checking.

## Risks

- The popup primitives are shared across admin and gateway surfaces, so
  the change affects multiple menus and selectors at once.
- The touched files were already out of sync with the repository's
  current style rules, so focused lint autofix was needed to get them
  back to a verifiable state.

## Scope

Affected areas:

- `crates/gated-web/src/shared/components/ui/select.tsx`
- `crates/gated-web/src/shared/components/ui/dropdown-menu.tsx`
- `crates/gated-web/src/shared/components/ui/context-menu.tsx`
- `docs/changelog.md`

## Alternatives

- Fix only `select.tsx`.
  Smaller, but the same forced-dark popup pattern also existed in the
  shared dropdown and context menu primitives.

## Annotations

- 2026-04-23 16:40: Identified the forced-dark popup theme issue in the
  shared popup primitives.
- 2026-04-23 16:42: Approved the shared popup fix scope.
- 2026-04-23 16:48: Completed the popup theme fix and verified it with
  focused frontend linting and type-checking.
