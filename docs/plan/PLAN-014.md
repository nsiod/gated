# PLAN-014 Record browser SQL Console and direct DB proxy sessions

- **status**: completed
- **createdAt**: 2026-04-23 16:55
- **approvedAt**: 2026-04-23 17:05
- **relatedTask**: BUG-008

## Context

The repository currently records:

- SSH terminal sessions
- Kubernetes exec/attach and API activity
- browser DB terminal sessions over the WebSocket terminal routes

The repository does not currently record:

- browser SQL Console queries handled by
  `crates/gated-protocol-http/src/api/db_query.rs`
- direct native MySQL/Postgres proxy sessions handled by
  `crates/gated-protocol-mysql` and
  `crates/gated-protocol-postgres`

Those paths are structurally different from terminal playback:

- SQL Console is request/response oriented and already has a clean HTTP
  API boundary.
- Native DB proxy traffic is long-lived protocol traffic and may expose
  SQL statements, prepared statements, result metadata, and raw packets
  depending on where recording hooks are attached.

The existing admin recordings detail APIs currently support:

- terminal cast playback for `RecordingKind::Terminal`
- JSON item inspection for `RecordingKind::Kubernetes`
- tcpdump-style payload streaming for `RecordingKind::Traffic`

So this task needs both a backend capture decision and an admin display
strategy, not just a write hook.

## Proposal

Implement the two missing paths with different recording models instead
of forcing both into terminal playback:

1. Browser SQL Console
   Record each query as a structured request/response item:
   target kind, target name, SQL text, effective row limit,
   statement kind, readonly flag, execution time, success/failure, and
   a bounded response summary.
2. Direct native MySQL/Postgres proxy sessions
   Record structured SQL audit events at the protocol layer when a
   concrete SQL statement is observed, rather than trying to record raw
   protocol bytes as terminal playback.
3. Admin UI / APIs
   Extend recording metadata and detail APIs so these new DB query
   recordings render as structured JSON detail, not asciinema casts.
4. Keep terminal recording unchanged.
   Do not attempt to synthesize fake terminal replays for SQL Console or
   native protocol sessions in this pass.

## Risks

- Native protocol support is the hard part because prepared statements,
  multi-step execution, and protocol differences between MySQL and
  Postgres may need separate hooks.
- Recording full result sets could be too large or leak more data than
  intended; summaries or truncation rules need to be explicit.
- Reusing `RecordingKind::Kubernetes`-style JSON inspection for DB
  query events may work technically but could be semantically awkward if
  a dedicated kind is more appropriate.

## Scope

Expected work areas:

- `crates/gated-protocol-http/src/api/db_query.rs`
- `crates/gated-protocol-mysql`
- `crates/gated-protocol-postgres`
- admin recording detail endpoints and metadata mapping
- focused tests
- `docs/changelog.md` after implementation

This likely crosses more modules than the previous DB terminal fix.

## Alternatives

- Record only browser SQL Console and defer native DB proxy sessions.
  Smaller, but does not satisfy the user-reported gap.
- Record raw protocol packets for native DB sessions using
  `RecordingKind::Traffic`.
  Lower-level and potentially more complete, but much harder to inspect
  meaningfully in admin UI and less aligned with the user asking whether
  SQL activity was recorded.
- Force everything into terminal recording format.
  This does not fit SQL Console request/response traffic and would
  create misleading playback.

## Annotations

- 2026-04-23 16:55: Initial proposal drafted after confirming that
  browser SQL Console and direct native DB proxy sessions still bypass
  the recordings subsystem.
- 2026-04-23 17:05: User approved the narrowed scope to record only the
  final executed SQL, one event per request, including failed requests.
- 2026-04-23 17:18: Implemented SQL-only audit recordings for browser
  SQL Console requests plus direct native MySQL/Postgres proxy query
  requests, then verified with focused Rust and frontend checks.
- 2026-04-23 17:30: Requirement refined after implementation review:
  keep one recording per session and append one SQL audit item per
  request instead of creating one recording per request.
- 2026-04-23 17:38: Completed the session-grouping follow-up by adding
  a stable SQL Console session key on the frontend, grouping backend
  SQL Console recordings by session, updating admin API/detail UI to
  inspect appended SQL items, and re-running focused Rust and frontend
  verification.
