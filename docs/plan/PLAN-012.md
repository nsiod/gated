# PLAN-012 Make CLI terminals use a light theme in light mode

- **status**: completed
- **createdAt**: 2026-04-23 15:55
- **approvedAt**: 2026-04-23 16:00
- **relatedTask**: UI-028

## Context

The reported issue is visible in the gateway terminal surfaces under light mode. The current implementation hardcodes dark terminal visuals in two separate terminal paths:

- `crates/gated-web/src/features/gateway/lib/terminal-sessions.ts`
  The route-based terminal session creates xterm with `theme: { background: '#1a1a1a' }` and is used by SSH plus DB CLI routes.
- `crates/gated-web/src/features/client/pages/terminal-panel.tsx`
  The integrated workspace terminal creates xterm with a full dark palette for SSH and DB CLI tabs.

The surrounding page in `crates/gated-web/src/features/gateway/pages/terminal.tsx` also hardcodes `bg-[#1a1a1a]`, so the container stays dark even if xterm is changed. Current theme context stores only `light|dark|system`; the terminal code does not derive the resolved theme or react when the document theme changes.

## Proposal

Implement light-mode CLI terminal theming in the smallest consistent way:

1. Introduce a shared terminal theme helper for gateway terminals that returns xterm color tokens for resolved `light` or `dark` mode.
2. Update the route-based terminal session to accept and apply the resolved theme instead of hardcoding a dark background, so SSH and DB CLI routes share the same behavior.
3. Update `terminal.tsx` to derive the resolved theme from the current document/app theme and keep the page container aligned with the xterm surface.
4. Update the integrated `TerminalPanel` to use the same resolved-theme helper so `/ui` and workspace tabs stay visually consistent for SSH and DB CLI terminals.
5. Limit the scope to terminal surfaces; do not change SQL Console editor theming or recording playback themes unless the implementation requires a small shared utility placement.

## Risks

- Existing terminal sessions are cached; if theme switching is handled incorrectly, already-open SSH or DB CLI sessions may not repaint until reopened.
- `system` theme must resolve against the actual current document mode; using the stored preference alone would be incorrect.
- Terminal contrast must stay high enough for prompts and ANSI colors in light mode.

## Scope

Expected files:

- `crates/gated-web/src/features/gateway/lib/terminal-sessions.ts`
- `crates/gated-web/src/features/gateway/pages/terminal.tsx`
- `crates/gated-web/src/features/client/pages/terminal-panel.tsx`
- optional new shared terminal theme helper
- `docs/changelog.md` after implementation

No backend or route contract changes.

## Alternatives

- Change only `terminal.tsx` page background.
  This would leave the actual xterm viewport dark and would not address the workspace terminal.
- Change only the route-based terminal.
  This would create inconsistent visuals between standalone `/ui` terminal routes and the workspace tab terminal.
- Add a dedicated user terminal theme setting.
  This is larger than the requested fix and introduces new product surface.

## Annotations

- 2026-04-23 15:55: Initial proposal drafted after tracing both SSH terminal entry points and the current theme context usage.
- 2026-04-23 15:58: User expanded the requested scope to include SQL CLI mode in addition to SSH.
- 2026-04-23 16:00: User approved implementation for light-mode theming across SSH and DB CLI terminals.
- 2026-04-23 16:10: Implemented the shared CLI terminal palette and resolved-theme wiring across route terminals and workspace terminal tabs, then verified with focused eslint and TypeScript checks.
