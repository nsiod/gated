# Security Audit & Status

> This document tracks the security posture of Gated: open concerns,
> the remediation status of each, and the process for adding new
> findings.

## Status at a Glance

| Category | Open | In-progress | Fixed (rolling 90d) |
|----------|------|-------------|---------------------|
| Access control / auth | 0 | 0 | 0 |
| SQL Console / DB proxy | 2 | 0 | 2 |
| Supply chain | 1 | 0 | 0 |
| Code hygiene (panic paths) | 2 | 0 | 0 |
| Observability / forensics | 1 | 0 | 0 |

## Process

- **Where**: new findings are tracked as `SEC-NNN` tasks in `docs/task/`.
  This document summarises active risk and points to those tasks.
- **Who**: any contributor may raise a `SEC-NNN` task. Critical/high
  findings must also reference an external report (Linear, GitHub
  Security Advisory, penetration test).
- **When**: the status table above is refreshed whenever a `SEC-NNN`
  task moves between open/in-progress/fixed.
- **Severity**: use CVSS-style rubric (Critical / High / Medium / Low).
  Map is informal; the prose description for each finding is what
  matters.

## Historical note: 2026-03-19 audit

`docs/changelog.md` (2026-03-19 entry) references a full security and
code-quality audit that produced "49 findings: 8 critical, 10 high,
14 medium, 17 low". The raw report was not persisted in the repository
and has been lost to a git history reset on the same day. Rather than
reconstructing the numbered list from memory (which would be
misleading), this document supersedes it with a rolling register
starting 2026-04-18.

If the original audit report is recovered from out-of-band storage
(Notion, Slack attachments, private notes), its findings should be
merged into this document under their original severity levels and
this note amended.

## Open findings

### SEC-003-A: `governor` keyed rate-limiter state is unbounded (Medium)

**Where**: `crates/gated-core/src/sql_console_rate_limit.rs`.
`DefaultKeyedRateLimiter<Uuid>` grows one state entry per unique
`user_id` / `target_id` forever. governor 0.10 has no built-in
eviction.

**Impact**: in deployments with high user or target cardinality,
memory grows slowly but without bound. Denial-of-service via
synthetic user IDs is limited because the same machinery requires
authenticated user IDs — however, a compromised auth flow could
amplify the concern.

**Mitigation**: periodic sweep on session-cleanup tick (reuse the
`auth_state_store.vacuum()` cadence in `Services::new`) to rebuild
the keyed limiter from scratch. Tracked as a follow-up to **SEC-001**
(which already ships the limiter without eviction).

### SEC-003-B: `db_terminal.rs:256` `indexing-slicing` panic path (Low)

**Where**: `crates/gated-protocol-http/src/api/db_terminal.rs` line
256: `buf[..n]` where `n` comes from the PTY read result.

**Impact**: `n` is guaranteed non-negative by the read return; the
slice cannot panic in practice. However, `clippy::indexing-slicing`
flags it, blocks strict clippy CI, and masks future regressions.

**Mitigation**: replace with `buf.get(..n).unwrap_or(&[])` or
`&buf[..n.min(buf.len())]`. Tracked under **REFACTOR-004** (general
unwrap/panic-path cleanup) and separately prevents strict clippy from
passing — consider promoting to P1 if CI is gated on clippy
(**INFRA-003**).

### SEC-003-C: Non-DB gateway endpoints have no request rate limit (Medium)

**Where**: `crates/gated-protocol-http/src/api/{auth,credentials,
api_tokens,targets_list,sso_provider_list,info}.rs`.

**Impact**: an authenticated attacker can brute-force credential
validation, API-token listing, or target enumeration without
triggering the `RateLimiterRegistry` (which only covers protocol
byte streams) or the new `SqlConsoleRateLimiter` (scoped to DB
endpoints).

**Mitigation**: broaden the per-user-per-endpoint limiter from
SEC-001 to cover these routes. Tracked as a new SEC-NNN task once
the generalised middleware pattern lands in **REFACTOR-002** (OpenAPI
migration, which will also expose a consistent attachment point).

### SEC-003-D: Supply-chain advisories not checked in CI (Medium)

**Where**: `.github/workflows/*.yml` does not run `cargo audit`,
`cargo deny`, or any equivalent.

**Impact**: known-vulnerable transitive dependencies reach production
without any signal.

**Mitigation**: add `cargo audit` + `cargo deny check advisories`
to the CI pipeline. Tracked as part of **INFRA-003** (CI quality
gates).

### SEC-003-E: Structured audit logs are not centralised (Low)

**Where**: `tracing::info!` / `tracing::warn!` events at key
security-relevant points (`sql_console_query`, `sql_console_rate_
limit_exceeded`, `sql_console_readonly_violation`, auth success /
failure).

**Impact**: events are emitted but rely on the operator configuring
external log shipping. No tamper-evident append-only record is
written by Gated itself.

**Mitigation**: evaluate writing a subset of events to a dedicated
`audit_log` table with append-only semantics. Out of scope for
PLAN-007; file under future "audit storage" initiative.

## Closed in PLAN-007 (2026-04-18)

- **SEC-001**: per-user and per-target request-rate limiting added to
  the six SQL Console / DB Terminal endpoints. HTTP 429 +
  `Retry-After`; WebSocket `rate_limited` status frame.
- **SEC-002**: tokenizer-based read-only SQL validator replaces the
  previous prefix-only check. Rejects multi-statement scripts,
  writable CTEs, comment-wrapped writes, and dangerous server-side
  functions (`pg_read_server_files`, `xp_cmdshell`, `load_file`,
  `pg_sleep`, `benchmark`, etc.).

## See also

- `docs/plan/PLAN-007.md` — currently active review & hardening plan.
- `docs/task/SEC-001.md` / `docs/task/SEC-002.md` / this file — per-
  task detail.
- `docs/changelog.md` — chronological record of shipped changes.
