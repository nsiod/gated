# PLAN-010 Fix Kubernetes upstream CA verification

- **status**: completed
- **createdAt**: 2026-04-23 14:54
- **approvedAt**: 2026-04-23 14:54
- **relatedTask**: BUG-006

## Context

Kubernetes target traffic is proxied by
`crates/gated-protocol-kubernetes/src/server/handlers.rs`, and both the
normal HTTP path and websocket path build their upstream reqwest client
through `create_authenticated_client()` in
`crates/gated-protocol-kubernetes/src/server/auth.rs`.

That client builder currently supports:

- disabling certificate verification with
  `danger_accept_invalid_certs(true)` when `tls.verify = false`
- setting bearer token auth
- setting client certificate identity for mTLS upstream auth

It does not support loading a Kubernetes API CA bundle. As a result,
self-signed or private CA clusters fail verification inside gated when
`tls.verify = true`.

`TargetKubernetesOptions` in `crates/gated-common/src/config/target.rs`
also has no field for an upstream CA PEM bundle, and the admin target
form only exposes cluster URL, TLS mode/verify, and auth credentials.

Existing tests in `tests/kubernetes/integration.test.ts` use
`tls.verify = false` for all Kubernetes targets, so the missing CA trust
path is not covered today.

## Proposal

Implement the smallest complete fix:

- extend `TargetKubernetesOptions` with an optional PEM CA bundle field
  for upstream Kubernetes verification
- teach `create_authenticated_client()` to load each PEM certificate as
  a reqwest root certificate when the field is present
- expose the field in the admin target form so the config round-trip is
  complete
- add focused integration coverage for `tls.verify = true` with the K3s
  test CA

Verification:

- run the Kubernetes integration test file
- run focused Rust tests/checks for the touched crate if needed
- run frontend typecheck if the admin form/openapi types change

## Risks

- PEM parsing must accept certificate bundles, not just a single cert.
- Adding a new optional field changes API schema and generated frontend
  types, so the UI build must still compile against the backend model.
- A malformed CA bundle should fail target use clearly without changing
  `verify = false` behavior.

## Scope

Backend target model, Kubernetes proxy TLS builder, admin target form,
integration tests, and the required task/plan/changelog records.

## Alternatives

- Keep using `tls.verify = false`. Rejected because it avoids the bug
  instead of fixing gated's verification path.
- Import full kubeconfig files instead of a CA field. Rejected as too
  broad for this bugfix.

## Annotations

- 2026-04-23 14:54: Approved by user with `proceed`.
- 2026-04-23 15:04: Implemented optional Kubernetes upstream CA bundle
  support, updated the admin target form, and added verify=true
  integration coverage using the K3s test CA.
- 2026-04-23 15:04: Verification passed with
  `cargo test -p gated-protocol-kubernetes`,
  `cargo fmt --all`,
  `pnpm exec tsc --noEmit -p tsconfig.json`,
  and `pnpm exec eslint src/features/admin/pages/config/target-form.tsx`.
  `bun test tests/kubernetes/integration.test.ts` was blocked because
  `bun` is unavailable in this environment.
