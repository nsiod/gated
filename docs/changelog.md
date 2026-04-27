# Gated Changelog

## 2026-04-23 04:55 [feature]

AUTH-002: self-service access tickets — users can now issue / list / revoke
limited-use tickets for their own authorised targets from
`/ui/profile/tickets`.

Changes:
- Added gateway endpoints `GET/POST/DELETE /profile/tickets`
  (`crates/gated-protocol-http/src/api/tickets.rs`). `username` is taken from
  the authenticated session (not request body); `POST` enforces
  `config_provider.authorize_target(username, target_name)` and returns 403
  if the user has no role intersection with the target.
- Extended gateway TS client with `ExistingProfileTicket` /
  `NewProfileTicket` / `ProfileTicketAndSecret` types and matching
  `getMyTickets` / `createMyTicket` / `deleteMyTicket` methods.
- New `profile-tickets.tsx` page (target dropdown sourced from
  `useTargetsQuery` so non-authorised targets aren't even selectable), with
  expiry-in-days and number-of-uses fields (0 = never / unlimited), and a
  one-time secret reveal dialog.
- Sidebar + profile-page entry, router registration, en/zh-CN i18n under
  `gateway.tickets.*`.
- OpenAPI schema regenerated.

## 2026-04-23 22:14 [BUG-P1]

BUG-009: fix gateway API target actions so they show a copyable curl
proxy command instead of a misleading direct host link.

`crates/gated-web/src/features/gateway/pages/target-list.tsx` now
renders API targets with a monospace curl preview plus `CopyButton`
using the required `X-Gated-Target` header and the gateway external
host. The copied example now also includes
`-H 'x-gated-token: <TOKEN>'` as the token placeholder header.
`WebAdmin` targets keep the existing direct-link behavior.
Added focused coverage in
`crates/gated-web/src/features/gateway/pages/target-list.test.tsx` to
assert that API rows copy the curl command and no longer render the
direct host link.

Verification: `pnpm exec vitest run
src/features/gateway/pages/target-list.test.tsx`, `pnpm exec eslint
src/features/gateway/pages/target-list.tsx
src/features/gateway/pages/target-list.test.tsx`, and `pnpm exec tsc
--noEmit -p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 22:07 [BUG-P1]

UI-031: replace the stock React Router application error screen with a
branded global web error page.

`crates/gated-web/src/app/router.tsx` now wraps the app routes in a
root route with `errorElement`, so uncaught route-level runtime errors
and lazy-import failures render a custom recovery page instead of the
framework default screen. Added the new
`crates/gated-web/src/app/global-error-page{,.lib,.test}.tsx` files to
show localized guidance, retry/back/dashboard actions, theme and
language toggles, and a compact technical-details panel. Added the
matching `errorPage` copy to
`crates/gated-web/public/locales/{en,zh-CN}/common.json`.

Verification: `pnpm exec vitest run src/app/global-error-page.test.tsx`,
`pnpm exec tsc --noEmit -p tsconfig.json`, and `pnpm exec eslint
src/app/router.tsx
src/app/global-error-page.tsx
src/app/global-error-page.lib.ts
src/app/global-error-page.test.tsx` in `crates/gated-web`.

## 2026-04-23 21:24 [BUG-P1]

UI-030: make database assets in the terminal workspace open CLI tabs by
default instead of SQL Console tabs.

`crates/gated-web/src/features/client/components/client-layout.tsx` now
resolves the default workspace tab mode to CLI, so clicking MySQL or
Postgres assets and using other default-open entry points in the
workspace opens the CLI terminal unless the user explicitly chooses SQL
Console from the context menu.

Verification: `pnpm exec tsc --noEmit -p tsconfig.json` and `pnpm exec
eslint src/features/client/components/client-layout.tsx` in
`crates/gated-web`.

## 2026-04-23 17:18 [BUG-P1]

BUG-008: record browser SQL Console and direct DB proxy SQL activity as
session-grouped audit recordings.

`crates/gated-protocol-http/src/api/db_query.rs` now groups browser SQL
Console requests by a stable console session key, ensures a matching
synthetic `sessions` row exists, and appends one structured SQL audit
item per request, including readonly rejections. The native MySQL and
Postgres proxy sessions in
`crates/gated-protocol-mysql/src/session.rs` and
`crates/gated-protocol-postgres/src/session.rs` now append one SQL audit
item per executed request into a single per-session API recording,
including prepared-statement executes resolved back to their final SQL.
These recordings persist only the final executed SQL, target/context,
statement kind, elapsed time, success/failure, and error text; they do
not store query results. The admin recording page now treats these as
session recordings, showing session metadata from
`crates/gated-web/src/shared/lib/recordings.ts` plus the appended SQL
event list fetched through the new API recording detail endpoint.

Verification: `cargo check -p gated-protocol-http -p
gated-protocol-mysql -p gated-protocol-postgres -p gated-core
-p gated-admin`,
`pnpm exec tsc --noEmit -p tsconfig.json`, and `pnpm exec vitest run
src/shared/lib/recordings.test.ts` in `crates/gated-web`.

## 2026-04-23 16:48 [BUG-P1]

UI-029: fix light-theme selection popovers rendering with dark popup
surfaces.

The shared popup primitives in
`shared/components/ui/{select,dropdown-menu,context-menu}.tsx` no
longer force a `dark` class on popup content, so `bg-popover`,
`text-popover-foreground`, and related semantic tokens now follow the
active light or dark theme correctly. Focused `eslint --fix` was also
applied to those touched files because they were already out of sync
with the repository's current style rules and blocked targeted lint
verification.

Verification: `pnpm exec eslint --no-ignore
src/shared/components/ui/select.tsx
src/shared/components/ui/dropdown-menu.tsx
src/shared/components/ui/context-menu.tsx` and `pnpm exec tsc
--noEmit -p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 16:08 [BUG-P1]

BUG-007: record MySQL and Postgres gateway terminal sessions.

The WebSocket DB terminal routes in
`crates/gated-protocol-http/src/api/db_terminal.rs` now start a
`TerminalRecorder` once the session is registered, then write PTY input,
output, and resize events into the existing terminal recording format so
admin replay can reuse the current terminal player. Added DB terminal
recording metadata for MySQL and Postgres targets, and extended
`crates/gated-web/src/shared/lib/recordings.ts` so admin recording
detail pages show meaningful type labels and target metadata instead of
`Unknown type`.

Verification: `cargo fmt --all`, `cargo check -p gated-protocol-http`,
`pnpm exec vitest run src/shared/lib/recordings.test.ts`, and
`pnpm exec tsc --noEmit -p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 16:10 [BUG-P1]

UI-028: make gateway CLI terminals follow a light palette in light
mode while preserving the existing dark palette in dark mode.

Added a shared CLI terminal theme helper and resolved-theme hook in
`shared/lib/terminal-theme.ts` and
`shared/hooks/use-resolved-theme.ts`. The standalone terminal route in
`features/gateway/pages/terminal.tsx`, the cached terminal session in
`features/gateway/lib/terminal-sessions.ts`, and the workspace tab
terminal in `features/client/pages/terminal-panel.tsx` now apply the
same light or dark xterm palette for SSH, MySQL CLI, and Postgres CLI
surfaces. Existing cached sessions also repaint when the resolved app
theme changes.

Verification: `pnpm exec eslint
src/features/gateway/lib/terminal-sessions.ts
src/features/gateway/pages/terminal.tsx
src/features/client/pages/terminal-panel.tsx
src/shared/lib/terminal-theme.ts
src/shared/hooks/use-resolved-theme.ts` and `pnpm exec tsc --noEmit
-p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 15:47 [BUG-P1]

UI-027: simplify `/ui` target list actions by removing the inline
connection command preview and reordering action buttons for clearer
scanning.

Gateway target rows in `features/gateway/pages/target-list.tsx` no
longer render the truncated command chip in the Actions cell. SSH rows
now show `Open Terminal` then `Copy`; MySQL and Postgres rows show
`Open SQL Console`, `Open Terminal`, then `Copy`. The actions container
also allows wrapping so buttons stay readable instead of compressing
the row content.

Verification: `pnpm exec eslint
src/features/gateway/pages/target-list.tsx` and `pnpm exec tsc
--noEmit -p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 15:04 [BUG-P1]

BUG-006: fix Kubernetes proxy upstream TLS verification for clusters
with private or self-signed CAs.

`TargetKubernetesOptions` now accepts an optional `ca_certificate` PEM
bundle. The Kubernetes proxy loads each certificate from that bundle
into the reqwest root store before connecting upstream, so
`tls.verify = true` works against clusters whose apiserver certificates
are not rooted in the system trust store. The admin target form now
round-trips the CA bundle, and the Kubernetes integration test fixture
exports the K3s CA so verify-enabled proxy coverage can use it.

Verification: `cargo test -p gated-protocol-kubernetes`, `cargo fmt
--all`, `pnpm exec tsc --noEmit -p tsconfig.json`, and `pnpm exec
eslint src/features/admin/pages/config/target-form.tsx`. `bun test
tests/kubernetes/integration.test.ts` could not run because `bun` is
not installed in this environment.

## 2026-04-23 15:25 [BUG-P1]

BUG-005: fix `/ui/admin/log` message overflow on narrow screens.

The audit log Message column in
`features/admin/pages/log.tsx` now overrides the shared table cell
`whitespace-nowrap` default with `whitespace-normal break-all`, so long
messages wrap within the viewport instead of stretching the table and
forcing horizontal page scrolling.

Verification: `pnpm exec eslint src/features/admin/pages/log.tsx`
(with two pre-existing warnings only) and `pnpm exec tsc --noEmit -p
tsconfig.json` in `crates/gated-web`.

## 2026-04-23 15:10 [BUG-P1]

BUG-004: fix admin sessions list search so visible target names are
included in the local `DataTable` filter.

`/ui/admin` sessions search is frontend-only. The Target column in
`features/admin/pages/sessions.tsx` rendered `target.name` but did not
expose it through an accessor, so TanStack Table global filtering could
not match queries like `Target` even when that text was visible in the
table. The column now uses `accessorFn: row => row.target?.name ?? ''`
while keeping the existing cell rendering unchanged.

Added focused Vitest coverage in `features/admin/pages/sessions.test.tsx`
to assert that target-name queries retain only matching rows.

Verification: `pnpm exec vitest run
src/features/admin/pages/sessions.test.tsx`, `pnpm exec eslint
src/features/admin/pages/sessions.tsx
src/features/admin/pages/sessions.test.tsx`, and `pnpm exec tsc
--noEmit -p tsconfig.json` in `crates/gated-web`.

## 2026-04-23 13:48 [BUG-P1]

BUG-003: fix remaining `/ui/admin/recordings/:id` text overflow on
narrow screens.

The recording detail page now wraps long recording names and metadata
values instead of letting them stretch the layout horizontally.
`PageHeader` now allows its text column to shrink and wrap, and the
recording metadata card now applies `min-w-0` and `break-words` to
value cells while keeping `session_id` on `break-all`.

Verification: `pnpm exec eslint
src/shared/components/page-header.tsx
src/features/admin/pages/recording.tsx` and `pnpm exec tsc --noEmit -p
tsconfig.json` in `crates/gated-web`.

## 2026-04-23 13:44 [BUG-P1]

BUG-002: fix `/ui/admin/recordings/:id` horizontal overflow on
narrow screens.

The recording player now fits the xterm viewport to its container on
mount and resize, instead of letting recorded column counts push the
page wider than the device viewport. Added `min-w-0` / `max-w-full`
constraints around the player card and viewport, and allowed the
playback controls row to wrap on small screens so the range input and
speed selector do not force extra width.

Verification: `pnpm exec eslint
src/shared/components/terminal-player.tsx
src/features/admin/pages/recording.tsx` and `pnpm exec tsc --noEmit -p
tsconfig.json` in `crates/gated-web`.

## 2026-04-23 04:36 [BUG-P1]

BUG-001: fix ticket creation from `/ui/admin/config/tickets/new`
when an expiry is selected. The browser `datetime-local` value is
now converted to RFC3339 via `Date#toISOString()` before calling
`POST /tickets`, matching the backend `DateTime<Utc>` request schema.

Also tightened `number_of_uses` validation to positive integer strings
before submission and added focused Vitest coverage for blank optional
fields and expiry serialization.

Verification: `pnpm run check`, `pnpm exec vitest run
src/features/admin/pages/config/create-ticket.test.ts`, `pnpm run
test`, and focused ESLint. `bun`/`bunx` were unavailable in this
environment, so the checks were run with `pnpm` against the existing
frontend dependencies.

## 2026-04-19 23:00 [refactor]

REFACTOR-004 (PLAN-007): close out unwrap/expect hygiene. The lint
gate was already enforced by `Cranky.toml` (INFRA-003 promoted
`clippy::unwrap_used` / `expect_used` / `panic` to deny); `just
clippy` has been passing against that gate, meaning every non-test
unwrap/expect was already covered by a `#[cfg(test)]` or
`#[allow]`. This PR just tightens the *quality* of those allows:

- Every non-test `#[allow(clippy::unwrap_used)]` /
  `_expect_used` now carries a `reason = "..."` string so the
  invariant is documented inline.
- Fragile-looking
  `ldap_servers.rs::api_update_ldap_server`'s
  `.unwrap_or_else(|| model.bind_password.clone().unwrap())` moved
  into an explicit closure + scoped `#[allow]` + a comment
  explaining the Sea-ORM `ActiveValue` state invariant that
  guarantees the unwrap.
- Removed a stale allow on `auth_state_store::TIMEOUT` that had no
  unwrap on its line.

Touched: `gated-admin/{main,src/api/ldap_servers}`,
`gated-protocol-http/main`, `gated-common/{helpers/{locks,otp,hash},
config_schema,config/mod}`,
`gated-core/{logging/{http,database},auth_state_store}`,
`gated-database-protocols/error`,
`gated-protocol-ssh/server/session` (6 sites), `gated/main`,
`gated-sso/config`.

`cargo check` + `just clippy` + `cargo test -p gated-core
-p gated-common -p gated-admin` all clean. `clippy.toml`
(`allow-unwrap-in-tests = true`) intact. No public API changes.

## 2026-04-19 22:00 [refactor]

REFACTOR-003 (PLAN-007): lib-crate typed errors were already in
place (`LdapError` / `SsoError` / `CaError` / `RustlsSetupError` /
`gated_database_protocols::Error`). The missing pieces:

- `GatedError::status()` used to return `500` unconditionally, so
  typed variants wrapped via `#[from]` collapsed into
  `500 Internal Server Error` at the HTTP edge. Now branches:
  - 404: `InvalidTicket`, `UserNotFound`, `RoleNotFound`.
  - 400: `InvalidCredentialType`, `UrlParse`, `DeserializeJson`,
    `NoHostInUrl`, `ExternalHostNotWhitelisted`,
    `RateLimiterInvalidQuota`, `RusshKeys`.
  - 410: `SessionEnd`.
  - 502: `Reqwest`.
  - 500 (fallback): DB / CA / TLS / LDAP / SSO / I/O / `Anyhow` /
    `Other` / misc config faults.
- `gated-ldap/Cargo.toml`: dropped unused `anyhow.workspace = true`.
- `docs/architecture.md`: new *Error handling* section with the
  library-typed / service-aggregated convention + the full variant
  → status table.

`cargo check --all-features` + `cargo cranky` clean;
`cargo test -p gated-common` passes.

## 2026-04-19 21:00 [a11y]

UI-026 (PLAN-007): establish an accessibility baseline and wire
`@axe-core/react` into dev mode so future regressions surface as
console warnings.

### Already in place (audit)

- `shared/components/ui/button.tsx` already bakes
  `focus-visible:ring-[3px]` — all routed buttons keep a visible
  focus ring.
- Base UI `Dialog.Title` + `Dialog.Description` wire
  `aria-labelledby` / `aria-describedby` on the popup; the
  built-in close control has `<span class="sr-only">Close</span>`.
- `mode-toggle`, `language-toggle`, `copy-button` already carry
  sr-only labels.

### Changes

- **DataTable sort headers** (`shared/components/data-table.tsx`):
  sortable `<th>` carries `aria-sort="ascending|descending|none"`;
  header migrated from `<div onClick>` to `<button type="button">`
  (keyboard activation + focus ring); `<span class="sr-only">`
  announces sort direction via three new `common.table.*` keys
  (`sortedAsc` / `sortedDesc` / `sortUnsorted`), en + zh-CN in
  parity.
- **`user-detail-parts/` × 7 tabs**: each Trash2 icon-only button
  gained `aria-label={tc('actions.delete')}`.
- **`client-layout.tsx` SidebarToggle**: `aria-label` +
  `aria-expanded`.
- **`targets.tsx` row actions**: edit + delete icon buttons labelled
  via `common:actions.{edit,delete}`.
- **`@axe-core/react` dev integration** in `src/main.tsx`:
  dynamic-import + `import.meta.env.DEV` guard keeps the payload
  out of prod bundles. Main bundle unchanged at 838 KB / 239 KB
  gzip; `grep axe` on the built chunk returns nothing.

### Verification

- `bun run check`: clean.
- `bunx eslint` on all changed files: clean.
- `bun run test`: 28/28 (data-table smoke widened from exact
  `name: 'ID'` to `name: /ID/` because the columnheader now
  includes a sr-only sort-direction suffix).
- `bun run i18n-check`: parity OK.
- `bun run build`: clean, prod bundle unchanged.

## 2026-04-19 20:00 [refactor]

UI-025 (PLAN-007): split two large page components into co-located
parts so each main file lands well under the 500-line AC target.

### `features/admin/pages/config/user-detail.tsx`: 1406 → 145 lines

Extracted 10 sibling files under `user-detail-parts/`:
- `otp-uri.ts` — RFC 4648 base32 + `otpauth://` URI builder (+ unit
  tests against the RFC 4648 §10 vectors).
- `edit-user-card.tsx`, `ldap-card.tsx` — top-row cards.
- Seven credential tabs: `passwords-tab.tsx`, `public-keys-tab.tsx`,
  `otp-tab.tsx`, `certificates-tab.tsx`, `sso-tab.tsx`,
  `api-tokens-tab.tsx`, `roles-tab.tsx`.

Main file now just orchestrates: data fetch, `<PageHeader>`, 2-col
top row, and the 7-tab layout.

### `shared/components/database-console.tsx`: 600 → 320 lines

Extracted 4 sibling files under `shared/components/sql-console/`:
- `sql-history.ts` — localStorage query-history with per-target
  scoping + HISTORY_MAX truncation (+ 5 unit tests).
- `error-message.ts` — extract user-facing message from SQL errors.
- `schema-tree.tsx` — `SchemaNode` + `TableNode`.
- `result-grid.tsx` — sortable `<ResultGrid>` (formatCell now
  private to the module to satisfy `react-refresh/only-export-
  components`).

### Deferred — `target-form.tsx` (976 lines)

`TargetFormFields` alone is ~587 lines and dispatches per
`TargetKind` (Ssh / MySql / Postgres / Kubernetes / Api / WebAdmin)
with kind-specific sub-forms. Needs its own iteration; the
`user-detail-parts/` pattern is the template.

`bun run check` + `bunx eslint` clean on all new files. `bun run
build` unchanged main-bundle size (838 KB / 239 KB gzip).
`bun run test` 28/28 (was 23 pre-UI-025).

## 2026-04-19 19:00 [test]

TEST-002 (PLAN-007): gateway HTTP integration tests.

New `tests/http/` with 4 files / 12 tests:
- `login.test.ts` — correct / wrong / unknown credentials and OTP-
  required interstitial.
- `api-tokens.test.ts` — create + list + `X-Gated-Token` bearer
  auth + delete round-trip.
- `targets.test.ts` — gateway `/api/targets` filters by RBAC and
  `?search=` substring.
- `info.test.ts` — anonymous vs authenticated vs admin payload
  shape on `/api/info`.

All 12 pass locally against the debug binary (~11 s total).

### En-route bug fix

Every admin/gateway integration test was silently broken since
commit `d4f9740eb78` (refactor: remove @gated path prefix,
2026-03-23): helpers + test files still pointed at the removed
`/@gated/` URL prefix, so every call got a 307 redirect to the SPA
and failed to parse JSON. Global replace across
`tests/**/*.{ts,json}` restored them.

Touched: `tests/helpers/{api-client,process-manager,util,gated-
helpers,session}.ts`, `tests/api/auth/*.test.ts`, `tests/db/
postgres-auth-in-browser.test.ts`, `tests/kubernetes/integration
.test.ts`, `tests/ssh/auth-in-browser.test.ts`, `tests/oidc-mock/
clients-config.json`. Added `HttpSession.del()` helper.

Before/after reproduction recorded in `docs/task/TEST-002.md`.

## 2026-04-19 18:00 [infra]

INFRA-003 (PLAN-007): new `quality` job in
`.github/workflows/test.yml`, runs in parallel with `test` and
`frontend`:

- `just clippy` — cargo-cranky with the `Cranky.toml` deny set
  (`unsafe_code`, `unwrap_used`, `expect_used`, `panic`,
  `indexing_slicing`, `dbg_macro`).
- `cargo machete --with-metadata` — unused deps, stable-toolchain
  substitute for `cargo-udeps` (task spec allows this).
- `cargo deny check advisories bans sources licenses` against
  repo-root `deny.toml` (already shipped with advisory ignores +
  `openssl-sys` ban + license allow-list).
- `cd crates/gated-web && bun run test` (TEST-001 Vitest).
- `cd crates/gated-web && bun run i18n-check` (I18N-001).

Tools are cached at `~/.cargo/bin`; `target/` uses a dedicated
`cargo-quality-` cache key so clippy + deny passes don't invalidate
the `test` job's compile cache.

### Pre-existing blockers fixed

- `db_terminal.rs`: scoped `#[allow(clippy::indexing_slicing)]` with a
  `reason = "n bounded by Read::read contract"` on the PTY read-slice
  — rewriting with `.get(..n)` would silently drop bytes on a read
  contract violation and adds a bounds check per chunk for no gain.
- `gated-ca` + `gated-protocol-http`: `hex` needed the `alloc`
  feature under per-crate `cargo cranky`. In full-workspace builds
  another consumer pulled `alloc` in for them, so the bug only
  surfaced once per-crate clippy ran.
- `docs/architecture.md` CI/CD section rewritten to list the 4
  parallel jobs + the gates the `quality` job enforces.

## 2026-04-19 17:00 [test]

TEST-001 (PLAN-007): Vitest scaffolding for `crates/gated-web`.

- `vitest.config.ts` + `vitest.setup.ts`: jsdom env,
  `@testing-library/jest-dom` matchers, `afterEach(cleanup)`, scoped
  to `src/**/*.{test,spec}.{ts,tsx}` so the Bun integration suite
  under repo-root `tests/` stays separate.
- New `shared/testing/i18n.tsx::I18nTestProvider` — stripped-down
  `i18next` instance (`lng: 'cimode'`) without the HTTP backend so
  components that use `useTranslation` render in jsdom.
- `just test-web` recipe; `just cleanup` now chains through it.
- `tsconfig.json`: added `"types": ["vitest/globals"]` and
  `vitest.setup.ts` to `include`.
- Seeded tests (5 files, 19 tests): `shared/lib/{utils,errors,
  shell-escape}.test.ts`, `shared/components/{empty-state,data-table}
  .test.tsx`.

`bun run test`: 19/19 pass in ~2.2 s. `bun run check` (tsc) + eslint
clean on all new files.

## 2026-04-19 16:00 [perf]

PERF-002 (PLAN-007): lift the SQL Console sqlx pool cache out of
`gated-protocol-http::api::db_query`'s module-level
`Lazy<Mutex<HashMap<String, TargetPool>>>` into
`gated_core::db_pool_registry::DbPoolRegistry` on `Services`.

- Keyed by `Target::id` (was name). Each entry carries a
  connection-options fingerprint; `get_or_create` rebuilds + closes
  the old pool on mismatch. So target edits propagate without
  waiting for idle timeout, and renames no longer strand pools.
- Explicit `invalidate(target_id)` hook: called from
  `api_update_target` and `api_delete_target` (admin). The delete
  handler now takes `Services` instead of a bare `db` so it can
  reach the registry.
- Pool params are constants: `max_connections=5`,
  `acquire_timeout=10s`, `idle_timeout=300s`,
  `max_lifetime=3600s` (new — caps stale TCP sessions). DB-backed
  configurable params deferred (would need a parameters migration).
- New Prometheus gauges emitted on every `get_or_create`:
  `gated_db_pool_size{target}` (total) /
  `gated_db_pool_idle{target}` (idle). Descriptions registered in
  `gated_core::metrics::describe_metrics`; catalog updated in
  `docs/ops/metrics.md`.

`cargo test -p gated-core db_pool_registry`: 3/3 pass.
`cargo check --all-features` + `cargo cranky -p gated-core -p
gated-admin` clean. Pre-existing `db_terminal.rs` clippy warnings
unchanged.

## 2026-04-19 15:00 [perf]

PERF-001 (PLAN-007): lazy-load Monaco Editor so initial page JS no
longer ships the editor or its workers.

Split `shared/components/database-console.tsx` so all Monaco runtime
imports (`@monaco-editor/react`, `monaco-editor`, `monaco-setup`
side-effect) live in a new `shared/components/sql-editor.tsx`. The
console consumes it via `React.lazy(() => import('./sql-editor'))`
inside `<Suspense>`. Type-only imports remain in `database-console`
and are erased by `verbatimModuleSyntax: true`.

Bundle delta (Vite build):
- `dist/assets/index-*.js`: 953 KB → 838 KB (gzip 267.84 KB →
  239.28 KB, **−28 KB gzip**). `strings dist/assets/index-*.js |
  grep -c monaco-editor == 0`.
- `editor.api2-*.js` is no longer in `.vite/manifest.json` entry's
  `imports` list, and no `<link rel="modulepreload">` in `index.html`
  preloads it. Fetched only when `<Suspense>` boundary first resolves
  (SQL Console route or client-layout SQL tab).
- New `sql-editor-*.js` lazy chunk: 110 KB (gzip 27 KB).

`bun run check` clean; `bunx eslint` clean on changed files. No
Playwright setup in repo yet (TEST-001 still pending) — lazy load
verified via manifest + `<link>` preloads in built `index.html`.

## 2026-04-19 14:00 [refactor]

REFACTOR-002 (PLAN-007): last gateway `#[handler]` REST endpoints
migrated to `poem-openapi`. Four `/api/db/*` endpoints now live on the
`db_query::Api` OpenAPI tuple and drop the four hand-mounted
`.at(...)` routes from `lib.rs`:

- `GET  /api/db/schemas/:target_name`    (`get_db_schemas`)
- `GET  /api/db/tables/:target_name`     (`get_db_tables`)
- `GET  /api/db/columns/:target_name`    (`get_db_columns`)
- `POST /api/db/query/:target_name`      (`run_db_query`)

Shared `DbError` enum (`ApiResponse`) preserves the existing wire
contract — `{ "error": "..." }` body across 400/401/403/404/429/500/502
and `Retry-After: 60` on 429. Request/response structs gained `Object`
derives with `#[oai(rename = "type")]` matching the old
`#[serde(rename = "type")]` on `TableInfo.type`.

WebSocket endpoints (`/api/ssh/terminal`, `/api/{mysql,postgres}/terminal`)
stay on raw `#[handler]` — `poem-openapi` has no WebSocket upgrade
representation. Comment in `api/mod.rs` now documents that split.

Frontend stays on the handwritten `features/gateway/lib/api-client`
client — its type definitions already match the regenerated
`openapi-schema.json`. Switching to the generated client is a
follow-up (out of this PR's scope; see REFACTOR-002 Proposal note).

`cargo check --all-features` clean; `cargo test -p gated-protocol-http`
10/10 pass; `bun run check` (frontend tsc) clean;
`bun run openapi:schema:gateway` regenerated the spec with the four
new `components.schemas` (SchemaList / TableList / ColumnList /
QueryRequest / QueryResponse).

## 2026-04-19 10:30 [refactor]

REFACTOR-001 (PLAN-007): migrate `Services` shared state from
`Arc<Mutex<_>>` to `Arc<RwLock<_>>` and `Arc<ArcSwapOption<_>>` where
the access pattern makes it a net win.

Migrated fields:
- `db`, `config`, `state`: now `Arc<RwLock<_>>`. Read-heavy hot paths
  take `.read()`; mutation sites (`cleanup_db`, config reload,
  `apply_new_rate_limits`, `remove_session`) take `.write()`.
- `admin_token`: now `Arc<ArcSwapOption<String>>` — lock-free load via
  `.load().as_deref()`.

Kept on `Mutex`:
- `config_provider`, `auth_state_store`: every ConfigProvider /
  AuthStateStore method takes `&mut self`, so `RwLock` would force all
  callers onto the write path. Documented as a follow-up — the trait
  needs a `&mut self` → `&self` refactor first.
- `recordings`, `rate_limiter_registry`: balanced usage, out of scope.

~40 files updated. `cargo check --features mysql,postgres` clean
(0 warn / 0 error); `cargo test -p gated-core` passes; `bun test misc/`
(metrics / healthcheck / json-logs) passes and exercises startup +
auth + config reload + state registration paths.

## 2026-04-19 09:45 [feature]

OBS-002 (PLAN-007): deep healthcheck + `/healthz` + `/readyz`.

- `gated-core::healthcheck::deep_check` runs DB ping, pending-migration
  status, and a tx-roundtrip probe concurrently (`tokio::join!`), plus
  TLS certificate validity (warn if < 7 days, fail if expired). LDAP
  and SSO reachability are reported as `warn: not implemented` rather
  than `ok` so dashboards don't mistake placeholders for health.
- `gated healthcheck --deep [--skip-lookups]` CLI prints the report as
  JSON and exits `1` on `fail` without a backtrace. Uses a new
  `gated-core::db::open_db_connection` helper that skips migration
  application, so the CLI's `db.migrations` row reflects the real state
  instead of always returning green.
- `/healthz` (static 200) and `/readyz` (deep check with an outer
  1500ms guard; responds 503 on `fail`) are mounted on the metrics
  listener alongside `/metrics`.
- `docs/ops/healthcheck.md` — report shape, check semantics, K8s probe
  example, Docker HEALTHCHECK example, rationale for sharing the
  metrics port.
- Smoke test: `tests/misc/healthcheck.test.ts`.

## 2026-04-19 06:20 [feature]

OBS-001 (PLAN-007): Prometheus `/metrics` endpoint.

- New `metrics` config block (`enable: false` / `listen: 127.0.0.1:9090`
  by default); exporter serves Prometheus text-format `GET /metrics`
  over plain HTTP on an isolated listener, separate from the gateway's
  public TLS surface.
- `gated_core::metrics::install_recorder` installs the global recorder
  once at startup; if installation fails the gateway logs and carries
  on with metrics disabled (no startup block).
- Emit sites:
  - `gated_sessions_active{protocol}` — gauge, on `State::register_session`
    and `remove_session`.
  - `gated_auth_attempts_total{result, method}` — counter, on HTTP
    `/auth/login` and `/auth/otp`. `AuthResult::Need(...)` is treated
    as a pending multi-factor step, not a rejection.
  - `gated_db_query_total{target, result}` +
    `gated_db_query_duration_seconds{target}` — counter + histogram,
    on every SQL Console query.
  - `gated_rate_limit_rejected_total{endpoint}` — counter, on SQL
    Console and DB terminal rate-limit hits.
  - `gated_config_reload_total` — counter, on every YAML-watcher reload.
- `docs/ops/metrics.md` — metric catalog with emit sites and scraping
  example.
- Smoke test: `tests/misc/metrics.test.ts` (disabled: port unreachable;
  enabled: `GET /metrics` returns Prometheus output with our families).

Out of scope: per-`target` DB pool gauges (blocked on PERF-002) and
wire-protocol proxy connection counters.

## 2026-04-19 05:35 [tooling]

I18N-001 (PLAN-007): add `crates/gated-web/scripts/i18n-check.ts` —
flattens every locale namespace under `public/locales/*` and reports
any dot-path present in one locale but missing from another (works for
N locales, also catches orphan namespaces). Wired as
`bun run i18n-check` and `just i18n-check`; added to `just cleanup`.

Locale parity check across en / zh-CN × admin / common / gateway
reports clean, so no placeholder translations were added.

## 2026-04-19 05:20 [feature]

OBS-003 (PLAN-007): structured tracing on gateway auth / credentials /
DB terminal / SSH terminal handlers.

- `crates/gated-protocol-http/src/api/auth.rs`: replace a bare
  `error!("Auth rejected")` with `warn!(username, protocol, next_state,
  "auth_login_rejected")`; add success / OTP / logout audit events.
- `crates/gated-protocol-http/src/api/credentials.rs`: one audit
  `info!` per mutating self-service endpoint
  (password / public-key ×2 / OTP ×2 / certificate ×2).
- `crates/gated-protocol-http/src/api/db_terminal.rs`: add invalid-name
  / unauthenticated / authorize-failed warns and session started/ended
  info events with `session_id`, `username`, `target`, `kind`,
  `duration_ms`.
- `crates/gated-protocol-http/src/api/ssh_terminal.rs`: same shape for
  SSH web-terminal lifecycle.
- `docs/ops/logging.md`: new field dictionary covering the canonical
  fields, the audit event catalog (auth / credentials / SQL Console /
  DB terminal / SSH terminal), and the never-logged secrets list.

No behaviour change; no tests modified.

## 2026-04-19 04:20 [docs]

INFRA-002 (PLAN-007): refresh architecture docs against current state.

- `docs/architecture.md`: crate count 17 → 18 (via `cargo metadata`),
  add missing `gated-protocol-api` listing, add it to the dependency
  graph under `gated-protocol-http`, document the Gateway endpoint
  surface (admin vs user, OpenAPI vs raw `#[handler]`), add SQL Console,
  DB Terminal, SSH Terminal, API token rows, expand the Rate Limiting
  section with SEC-001 quota fields, and add a SQL Console (DB Phase 2)
  section covering pool cache, timeout stack, truncation, readonly
  validation, audit logs.
- `CLAUDE.md`: crate count 19 → 18.
- `README.md`: add SQL Console, web terminals, and API token features to
  the feature list.

No code changes.

## 2026-04-19 04:10 [test]

TEST-003 (PLAN-007): extend `tests/db/sql-console.test.ts` with SEC-002 /
FEAT-001 boundary coverage.

New cases:
- readonly enforcement variants (UPDATE / DROP / writable CTE / compound
  statement / block-comment-wrapped write / line-comment-prefixed write)
  against both MariaDB and Postgres targets;
- 5 MiB result truncation via 6 × ~1 MiB `REPEAT('x', ...)` UNION ALL rows;
- 30 s statement timeout via `SELECT SLEEP(40)` (MySQL) and `pg_sleep(40)`
  (Postgres);
- missing / unknown `X-Gated-Token` → 401;
- SSH target on `/api/db/schemas/:name` → 400 "Target is not a database".

File-local `provisionDbTarget` factory collapses ~15-line role/user/target/
token ritual; a lazy shared container per describe block cuts suite time
from ~100 s to ~87 s. All 11 SQL Console tests pass; the two pre-existing
Postgres auth-* failures use `startPostgresServer` host-port binding and
are unrelated to this change.

## 2026-04-18 22:55 [docs]

SEC-003 (PLAN-007): introduce `docs/security-audit.md` as the rolling security
register. Records the process for adding findings, a historical note about the
2026-03-19 audit whose raw report was lost during the git history reset,
and 5 open items (unbounded governor state, db_terminal indexing panic path,
missing rate limits on non-DB gateway endpoints, missing supply-chain CI
checks, centralised audit log gap). `docs/architecture.md` links to it.

## 2026-04-18 22:50 [feature]

SEC-002 (PLAN-007): harden read-only SQL Console enforcement.

Replaces the prefix-only `is_readonly_sql` check with a tokenizer-based validator
(`crates/gated-protocol-http/src/api/sql_validation.rs`) that strips comments,
string literals, quoted identifiers, and `$tag$` dollar-quotes, then verifies:

- the first keyword is `SELECT` / `SHOW` / `EXPLAIN` / `WITH` / `DESC[RIBE]`,
- no second statement follows (reject `SELECT 1; UPDATE t`),
- no write keyword appears anywhere (catches writable CTEs like
  `WITH w AS (DELETE FROM t RETURNING *) ...`),
- no dangerous server-side function is invoked (pg_read_server_files, lo_import,
  xp_cmdshell, load_file, pg_sleep, benchmark, ...).

Failures now surface the specific violation in the 403 response body and emit a
`sql_console_readonly_violation` audit log. 10 unit tests added.

## 2026-04-18 22:30 [feature]

SEC-001 (PLAN-007): per-user / per-target request-rate limiting on the SQL Console and DB Terminal gateway endpoints.

Changes:
- New `parameters` columns `sql_console_rate_limit_per_user` and `sql_console_rate_limit_per_target` (`Option<i64>` req/minute, null = unlimited); migration `m00002_sql_console_rate_limits`.
- New `gated_core::SqlConsoleRateLimiter` (keyed governor limiter, non-blocking `check`), wired through `Services` and refreshed after `PUT /admin/api/parameters`.
- All 6 endpoints (`/api/db/{schemas,tables,columns,query}/:target` and `/api/{mysql,postgres}/terminal/:target`) now enforce the limit; `429 Too Many Requests` with `Retry-After: 60` for HTTP and a WebSocket `rate_limited` status frame for terminals, plus a `tracing::warn!` audit line.
- Admin `ParameterValues` / `ParameterUpdate` gain the two optional fields; OpenAPI schema regenerated; TS client `dist/index.ts` synced.
- Unit tests: 5 new cases for limiter construction and behavior. Integration test: `tests/db/sql-console.test.ts` adds a per-user 429-with-Retry-After case.

Out of scope (followups): Admin UI form controls for the new fields; unbounded-growth eviction for the per-key limiter state (governor 0.10 has no built-in eviction).

## 2026-04-18 15:30 [feature]

FEAT-001: Web-based SQL GUI (DB Phase 2) — Monaco-backed SQL Console for MySQL and Postgres targets.

Changes:
- Backend (`crates/gated-protocol-http/src/api/db_query.rs`): new raw poem handlers for `/api/db/schemas/:target`, `/api/db/tables/:target`, `/api/db/columns/:target`, and `/api/db/query/:target`. Per-target sqlx pools (`max_connections = 5`), per-query `MAX_EXECUTION_TIME` / `statement_timeout = 30s`, 5 MiB result cap with truncation flag, readonly-prefix check (SELECT/SHOW/EXPLAIN/WITH/DESC) with comment stripping, per-query session row + structured `sql_console_query` audit log with sha256 SQL hash.
- `TargetMySqlOptions.readonly` and `TargetPostgresOptions.readonly` added with `#[serde(default)]` so existing configs upgrade cleanly; admin target form exposes a switch + hint.
- Frontend SQL Console page (`crates/gated-web/src/features/gateway/pages/sql-console.tsx`) under `/ui/db/:kind/:targetName/console`: left schema/table/column tree (lazy), Monaco editor (locally bundled via `monaco-editor` + `@monaco-editor/react` with Vite `?worker` setup), Run button + Ctrl/Cmd+Enter shortcut, LIMIT input (default 1000, cap 10 000), sortable result grid, results/history tabs, per-target localStorage history (last 50 queries).
- Gateway target list gains an "Open SQL Console" action for MySQL/Postgres rows alongside "Open Terminal".
- i18n additions in `gateway.json` (`sqlConsole.*`, `targetList.openSqlConsole`) and `admin.json` (`targets.readonly.*`) in en and zh-CN.
- Audit: every query emits a `tracing::info` entry (session id, username, target, statement_kind, sql hash, rows, truncated flag, duration) and uses `State::register_session("DbQuery", ...)` so the session shows up in the existing session list alongside SSH/DB terminal sessions.

Not in scope (followups): transactional multi-statement scripts, query cancellation, CSV/Excel export, cross-device server-side history, Kubernetes or API targets.

## 2026-04-18 11:50 [feature]

AUTH-001: admin can issue/revoke per-user API tokens from the user detail page.

Changes:
- Added admin endpoints `GET/POST/DELETE /admin/api/users/{user_id}/api-tokens` (`crates/gated-admin/src/api/api_tokens.rs`)
- Extended admin TS client with `ExistingApiToken`, `NewApiToken`, `ApiTokenAndSecret` types and corresponding `getUserApiTokens` / `createUserApiToken` / `deleteUserApiToken` methods
- New `ApiTokensTab` in admin user detail page: create with label + expiryDays (1–365), one-time secret reveal, revoke with confirm
- i18n (en, zh-CN) under `admin.json` → `users.credentials.apiTokens` / `users.credentials.apiToken.*`
- Reused existing `api_tokens` table, `x-gated-token` header validation, and secret generation; gateway self-service page (`/ui/profile/api-tokens`) was already in place

## 2026-04-18 02:15 [progress]

PMA tracking sync: reconcile task/plan status with shipped code.

Changes:
- UI-002/UI-004/UI-005 status: review → completed
- UI-003 status: done → completed
- UI-006 ~ UI-015 status: pending → completed (checklists ticked)
- PLAN-005 index marker: [ ] → [x]
- Updated docs/task/index.md and docs/plan/index.md timestamps

All Admin UI resource pages (target groups, roles, sessions, recordings, logs, LDAP, SSH keys, tickets, parameters) and Gateway user pages (targets, profile credentials, API tokens, web terminal) were already implemented in crates/gated-web; only the PMA tracking files were stale.

## 2026-03-19 11:00 [progress]

Project repository reset and documentation audit.

Changes:
- Reset git history to clean initial commit
- Created NOTICE file with upstream Warpgate attribution and branding disclaimer
- Updated README.md: corrected build commands (npm -> bun), added Kubernetes/LDAP/RBAC to features
- Updated CLAUDE.md: corrected build commands (npm -> bun)
- Fixed FUNDING.yml: removed upstream eugeny/tabby references, updated to bkhq
- Updated architecture.md: corrected CI/CD section (8 workflows -> 3 actual workflows)
- Completed full security and code quality audit (49 findings: 8 critical, 10 high, 14 medium, 17 low)
- Reset PMA task/plan indexes to clean state

## 2026-03-19 09:00 [progress]

Frontend modernization (gated-web).

Changes:
- Switched package manager from pnpm to bun
- Restructured src/ to feature-based organization (features/admin, features/gateway, shared/)
- Renamed all files to kebab-case convention
- Set up shadcn/ui with Button and DropdownMenu components
- Added i18n with react-i18next (zh-CN + en, lazy-loaded)
- Migrated theme from Zustand store to Context-based ThemeProvider (light/dark/system)
- Extracted providers.tsx, query-client.ts, router.tsx to app/ directory
- Updated Vite config, ESLint config
