# PLAN-013 Record MySQL and Postgres gateway terminal sessions

- **status**: completed
- **createdAt**: 2026-04-23 16:05
- **approvedAt**: 2026-04-23 16:06
- **relatedTask**: BUG-007

## Context

The current gateway exposes DB CLI WebSocket routes at
`/api/mysql/terminal/:target_name` and
`/api/postgres/terminal/:target_name` in
`crates/gated-protocol-http/src/api/db_terminal.rs`. These routes:

- authorize the user and resolve the target
- register a session in `State`
- spawn a PTY running `mysql` or `psql`
- bridge WebSocket frames to and from the PTY

Unlike the SSH gateway route in
`crates/gated-protocol-http/src/api/ssh_terminal.rs`, the DB terminal
route does not call `services.recordings.lock().await.start(...)` and
does not pass any recorder into the bridge loop. That means no
`recordings` row or recording file is created for DB terminal sessions.

The admin recordings UI reads recording rows from the backend and maps
metadata through `crates/gated-web/src/shared/lib/recordings.ts`.
Current metadata unions only include Kubernetes and SSH variants, so
even if DB recordings were added, the UI would currently label them as
`Unknown type` unless the metadata parser is extended.

## Proposal

Implement DB terminal recording in the smallest path that matches the
existing SSH terminal recording design:

1. Add DB terminal recording metadata types in the backend and frontend,
   carrying the protocol kind (`mysql` or `postgres`) and enough fields
   to render a meaningful recording label.
2. Start a `TerminalRecorder` in `handle_db_terminal()` after the DB
   session is registered and before the PTY bridge starts, mirroring the
   SSH terminal flow.
3. Extend the PTY bridge so outbound PTY bytes and terminal resize
   events are also written to the recorder when recording is available.
4. Add focused coverage for the new metadata mapping and, if practical
   within the existing test harness, for the DB terminal recording path.

## Risks

- PTY-based DB terminal traffic differs from the SSH remote client path,
  so recording resize/data events must match the terminal player format
  expected by existing admin replay code.
- If metadata is too sparse, recordings will exist but still present
  poorly in the admin UI.
- DB CLI startup banners and prompts may produce output before the
  recorder is attached if the recorder is initialized too late.

## Scope

Expected files:

- `crates/gated-protocol-http/src/api/db_terminal.rs`
- `crates/gated-web/src/shared/lib/recordings.ts`
- one or more focused tests under `crates/gated-web` and/or Rust HTTP
  gateway tests
- `docs/changelog.md` after implementation

I do not expect database schema or API route contract changes.

## Alternatives

- Reuse SSH metadata types and label DB terminals as generic shell
  recordings.
  This is smaller, but it makes admin replay ambiguous and loses the
  protocol distinction the user explicitly expects.
- Record only the DB target session row without terminal payload.
  This would make recordings appear in lists, but replay would still be
  empty and would not satisfy the user-visible behavior.

## Annotations

- 2026-04-23 16:05: Initial proposal drafted after tracing SSH and DB
  terminal recording paths and confirming the missing recorder
  integration.
- 2026-04-23 16:06: User approved implementation with `proceed`.
- 2026-04-23 16:08: Implemented DB terminal recorder startup plus PTY
  input/output/resize recording, extended admin metadata labels for
  MySQL/Postgres recordings, and verified with focused Rust and frontend
  checks.
