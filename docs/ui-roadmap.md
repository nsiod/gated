# UI Roadmap

A snapshot of every HTTP API endpoint that needs user-facing interaction,
mapped against the existing frontend so the next round of UI work has a
single source of truth for *what is built* vs *what is missing*.

Generated on 2026-04-28 against commit `62edd05`.

Legend:

- ✓ — fully covered by an existing page or panel
- ⚠ — partially covered; behaviour or sub-cases missing
- ✗ — no UI surface today

---

## 1. Authentication & Session (`/api/auth/*`, `/api/sso/*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `POST /api/auth/login` | Username + password login (may pivot to OTP) | ✓ `/ui/login` |
| `POST /api/auth/otp` | TOTP second factor | ✓ `/ui/otp` |
| `POST /api/auth/logout` | Sign out | ✓ user menu |
| `GET /api/sso/providers` | List available SSO entry points | ✓ login page buttons |
| `GET /api/sso/providers/:name/start` | Begin SSO OAuth flow | ✓ |
| `GET/POST /api/sso/return` | OAuth callback | ✓ transparent |
| `GET /api/sso/logout` | SSO single sign-out | ⚠ auto-triggered, no UI |
| `GET /api/auth/state` | Current session state | ✓ implicit |
| `DELETE /api/auth/state` | Destroy current auth state | ✗ |
| **`GET /api/auth/web-auth-requests`** | **Inbox of cross-device login approvals** | **✗ no page** |
| `GET /api/auth/web-auth-requests/stream` (SSE) | Push new requests | ✗ |
| `GET /api/auth/state/:id` | Inspect a pending request | ✗ |
| `POST /api/auth/state/:id/approve` | Approve | ✗ |
| `POST /api/auth/state/:id/reject` | Reject | ✗ |

> **Largest gap.** The whole "approve an SSH/DB login from another device
> via the browser" flow has a complete backend but zero UI.

## 2. End-User Self-Service (`/api/profile/*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET /api/info` | Current identity + server metadata | ✓ |
| `GET /api/targets` | Targets I can reach | ✓ `/ui/` |
| `GET /api/profile/credentials` | My credentials bundle | ✓ `/ui/profile/credentials` |
| `POST /api/profile/credentials/password` | Change password | ✓ `/ui/profile` |
| `POST /api/profile/credentials/public-keys` | Add public key | ✓ |
| `DELETE /api/profile/credentials/public-keys/:id` | Remove public key | ✓ |
| `POST /api/profile/credentials/otp` | Enrol OTP | ✓ |
| `DELETE /api/profile/credentials/otp/:id` | Remove OTP | ✓ |
| `POST /api/profile/credentials/certificates` | Upload X.509 client cert | ✓ |
| `DELETE /api/profile/credentials/certificates/:id` | Remove cert | ✓ |
| `GET/POST/DELETE /api/profile/api-tokens[/:id]` | API token CRUD | ✓ `/ui/profile/api-tokens` |
| `GET/POST/DELETE /api/profile/tickets[/:id]` | One-shot ticket CRUD | ✓ `/ui/profile/tickets` |

## 3. Database Sessions (`/api/db/*`, WS terminals)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET /api/db/schemas/:target` | Schema tree | ✓ `/ui/db/:kind/:target/console` |
| `GET /api/db/tables/:target` | Tables list | ✓ |
| `GET /api/db/columns/:target` | Column metadata | ✓ |
| `POST /api/db/query/:target` | Run SQL (timeout / truncation / read-only enforced) | ✓ |
| `WS /api/mysql/terminal/:target` | mysql CLI terminal | ✓ `/ui/db/mysql/:target` |
| `WS /api/postgres/terminal/:target` | psql CLI terminal | ✓ `/ui/db/postgres/:target` |
| `WS /api/ssh/terminal/:target` | SSH terminal | ✓ `/ui/ssh/:target` |

## 4. Admin — Session Monitoring (`/admin/api/sessions*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET /admin/api/sessions` | Live + historical sessions | ✓ `/ui/admin` |
| `DELETE /admin/api/sessions` | Bulk purge | ✓ |
| `GET /admin/api/sessions/:id` | Session detail | ✓ `/ui/admin/sessions/:id` |
| `GET /admin/api/sessions/:id/recordings` | Recordings under session | ✓ session detail |
| `POST /admin/api/sessions/:id/close` | Force-close a live session | ✓ |
| `GET /admin/api/recordings/:id` | Asciinema-style recording stream (SSH / CLI) | ✓ `/ui/admin/recordings/:id` |
| `GET /admin/api/recordings/:id/kubernetes` | Kubernetes recording | ⚠ same page; K8s-specific renderer TBD |
| `GET /admin/api/recordings/:id/api` | HTTP API recording | ⚠ same page; API renderer TBD |
| `POST /admin/api/logs` | Filtered log query | ✓ `/ui/admin/log` + target-detail logs tab |

## 5. Admin — Targets & Groups (`/admin/api/targets*`, `/admin/api/target-groups*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET/POST /admin/api/targets` | List / create | ✓ `/ui/admin/config/targets` |
| `GET/PUT/DELETE /admin/api/targets/:id` | Detail / edit / delete | ✓ |
| `GET /admin/api/targets/:id/known-ssh-host-keys` | SSH host fingerprints for the target | ✓ target-detail tab |
| `GET/POST/DELETE /admin/api/targets/:id/roles[/:role_id]` | Target ↔ role bindings | ✓ |
| `POST /admin/api/ssh/check-host-key` | Pre-flight SSH host key probe | ⚠ not wired into the target form |
| `GET/POST/PUT/DELETE /admin/api/target-groups[/:id]` | Group CRUD | ✓ `/ui/admin/config/target-groups` |

## 6. Admin — Users (`/admin/api/users*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET/POST /admin/api/users` | List / create | ✓ `/ui/admin/config/users` |
| `GET/PUT/DELETE /admin/api/users/:id` | Detail / edit / delete | ✓ |
| `GET/POST/DELETE /admin/api/users/:id/roles[/:role_id]` | Role bindings | ✓ roles tab |
| `POST /admin/api/users/:id/ldap-link/unlink` | Detach LDAP link | ✓ user-detail LDAP card |
| `POST /admin/api/users/:id/ldap-link/auto-link` | Re-link automatically | ✓ |
| `GET/POST/DELETE /admin/api/users/:user_id/credentials/passwords[/:id]` | Admin-managed password | ✓ tab |
| `GET/POST/PUT/DELETE /admin/api/users/:user_id/credentials/public-keys[/:id]` | Public keys (incl. PUT edit) | ✓ tab |
| `GET/POST/DELETE /admin/api/users/:user_id/credentials/otp[/:id]` | OTP | ✓ tab |
| `GET/POST/PATCH/DELETE /admin/api/users/:user_id/credentials/certificates[/:id]` | Certificates | ✓ tab |
| `GET/POST/PUT/DELETE /admin/api/users/:user_id/credentials/sso[/:id]` | SSO bindings | ✓ tab |
| `GET/POST/DELETE /admin/api/users/:user_id/api-tokens[/:id]` | Admin-managed API tokens | ✓ tab |

## 7. Admin — Roles & Tickets (`/admin/api/role*`, `/admin/api/tickets*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET/POST /admin/api/roles` | List / create | ✓ `/ui/admin/config/roles` |
| `GET/PUT/DELETE /admin/api/role/:id` | Detail / edit / delete | ✓ |
| `GET /admin/api/role/:id/targets` | Reverse lookup: targets in role | ✓ role detail |
| `GET /admin/api/role/:id/users` | Reverse lookup: users in role | ✓ role detail |
| `GET/POST /admin/api/tickets` | System-level tickets list / issue | ✓ `/ui/admin/config/tickets` |
| `DELETE /admin/api/tickets/:id` | Revoke | ✓ |

## 8. Admin — SSH Infrastructure (`/admin/api/ssh/*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET /admin/api/ssh/own-keys` | Gateway's own SSH host keys | ✓ `/ui/admin/config/ssh-keys` |
| `GET/POST /admin/api/ssh/known-hosts` | `known_hosts` table (discovered remote fingerprints) | ⚠ only via target-detail; no global list |
| `DELETE /admin/api/ssh/known-hosts/:id` | Remove a known-host entry | ⚠ same |

## 9. Admin — LDAP (`/admin/api/ldap-servers*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET/POST /admin/api/ldap-servers` | List / create | ✓ `/ui/admin/config/ldap` |
| `GET/PUT/DELETE /admin/api/ldap-servers/:id` | Detail / edit / delete | ✓ |
| `POST /admin/api/ldap-servers/test` | Connectivity probe | ✓ ldap-server detail |
| `GET /admin/api/ldap-servers/:id/users` | Remote LDAP user listing | ✓ |
| `POST /admin/api/ldap-servers/:id/import-users` | Import selected users | ✓ |

## 10. Admin — System Parameters (`/admin/api/parameters*`)

| Endpoint | Purpose | UI |
|---|---|---|
| `GET/PUT /admin/api/parameters` | Runtime parameters (config.yaml is separate) | ✓ `/ui/admin/config/parameters` |

---

## Gap Backlog

Prioritised list of missing UI work, ordered by user impact.

| Priority | Module | Backend surface | Notes |
|---|---|---|---|
| **P0** | **Cross-device login approval inbox** | `/api/auth/web-auth-requests*`, `/api/auth/state/:id/{approve,reject}`, SSE stream | New `/ui/auth-requests` page plus a top-bar badge that subscribes to the SSE stream. Required to use the device-auth flow at all from the browser. |
| P1 | Kubernetes & API recording viewers | `/admin/api/recordings/:id/kubernetes`, `/admin/api/recordings/:id/api` | Branch the recording page on session protocol — render proper viewers for kubectl exec recordings and HTTP request/response transcripts. |
| P1 | Global SSH `known_hosts` admin | `/admin/api/ssh/known-hosts` GET/POST/DELETE | Single `/ui/admin/config/known-hosts` list page so operators can audit / purge fingerprints without drilling into each target. |
| P2 | Pre-flight SSH host key probe | `/admin/api/ssh/check-host-key` | "Test connection" button on the SSH target form (create + edit) that surfaces the fingerprint before saving. |
| P2 | Active-session self-destroy | `DELETE /api/auth/state` | Trivial; either a "Sign out everywhere" entry in the user menu or merge into logout. |
| P3 | Streaming / bulk-op feedback | Multiple `DELETE /admin/api/sessions`-style bulk endpoints | Today they are request/response. Revisit when (and if) bulk feedback becomes a real complaint. |

## Stack notes (carry-over)

- **Authoritative API specs:** `crates/gated-protocol-http/openapi.json` (user
  surface) and `crates/gated-admin/openapi.json` (admin surface), regenerated
  with `just openapi`.
- **Frontend client packages:** `web/src/features/{gateway,admin}/lib/api-client`,
  regenerated from those schemas.
- **Component policy:** see the *UI Library Policy* section of the pma-web
  baseline — shadcn/ui + `@base-ui/react` only. No new component libraries
  should appear while closing these gaps.
- **State boundaries:** TanStack Query for every endpoint above; Zustand
  reserved for UI-only state. The auth-approval inbox should subscribe via
  TanStack Query's `useQuery` for the list and a separate `EventSource`
  subscription that calls `queryClient.invalidateQueries` on each event.
