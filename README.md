# Gated

A smart bastion host / access gateway for SSH, HTTPS, MySQL, PostgreSQL, and Kubernetes.

Based on [Warpgate](https://github.com/warp-tech/warpgate) by Warpgate contributors.

## Features

- SSH, HTTPS, MySQL, PostgreSQL, Kubernetes proxying
- Web SQL Console against MySQL / PostgreSQL targets (readonly-safe, 30 s statement timeout, 5 MiB result cap)
- Web SSH / DB terminals (xterm.js over WebSocket)
- Admin-issued user API tokens (`X-Gated-Token`)
- Centralized authentication with 2FA (TOTP) and SSO (OpenID Connect)
- LDAP / Active Directory integration
- Role-based access control (RBAC)
- Session recording and replay
- Web admin UI with live terminal
- Single binary, no dependencies
- Written in 100% safe Rust

## Build

```bash
# Prerequisites: Rust, Bun, just
just bun install --frozen-lockfile
just bun run build
cargo build --release

# Feature flags for database backends
cargo build --features mysql,postgres
```

## Dev workflow (frontend + backend, same origin)

Dev uses [`@nsio/nsl`](https://www.npmjs.com/package/@nsio/nsl) as a local
reverse proxy so that Vite (frontend) and the Rust gateway (backend) share a
single origin — `http://gated.localhost:<NSL_PORT>` — exactly like production.
No CORS workarounds, no `server.proxy`, cookies behave the way they will in
prod.

```text
http://gated.localhost:<port>/ui        → Vite (HMR, port allocated by nsl)
http://gated.localhost:<port>/api       → Rust gateway /api
http://gated.localhost:<port>/admin/api → Rust gateway /admin/api
```

`<port>` is whatever `nsl status` reports under `proxy.listen` — `:3355` on a
fresh nsl install, but a shared dev box may have its daemon configured on a
different port (`:1355`, etc.). `just dev`'s startup banner prints the real
URLs.

`config.yaml` ships with `http.tls: false` for dev so nsl can plain-HTTP
proxy to the gateway. Production should use `tls: true`.

```bash
just bun install      # pulls @nsio/nsl + concurrently on first run
just dev              # backend + frontend, Ctrl-C tears down both
just nsl-status       # daemon state and route table
```

If the dev environment cannot run nsl at all, fall back to `just bun run
dev:bare` (frontend only, Vite default port) and run the gateway with
`tls: true` on its own origin — but then cookies will diverge from production.

## License

Licensed under the [Apache License 2.0](LICENSE).

Gated is a derivative work of [Warpgate](https://github.com/warp-tech/warpgate) by Warpgate contributors. The original Warpgate project and its branding remain the property of their respective authors. See [NOTICE](NOTICE) for full attribution.
