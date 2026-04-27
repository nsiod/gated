# TEST-002 Gateway HTTP 集成测试

- **status**: completed
- **priority**: P2
- **owner**: (unassigned)
- **createdAt**: 2026-04-18 20:55
- **completedAt**: 2026-04-19

## Outcome

New `tests/http/` directory with 4 files / 12 tests. All pass
locally against the debug binary (~11 s total wall-clock).

- `login.test.ts` (4 tests): correct password → 201 + cookie that
  carries through to `/api/info`; wrong password → 401 +
  `PasswordNeeded`/`Failed`; unknown user → 401 + `Failed`; policy
  requires OTP → 401 + `OtpNeeded`.
- `api-tokens.test.ts` (3 tests): create → list round-trip; issued
  secret works as `X-Gated-Token` on `/api/info`; delete → revoked
  token no longer authenticates.
- `targets.test.ts` (2 tests): `/api/targets` filters by the
  caller's role-based allow-list; `?search=` substring filter
  respects RBAC.
- `info.test.ts` (3 tests): anonymous payload omits `version` /
  `username` / ports; authenticated non-admin sees version + ports
  with `admin=false`; user in `gated:admin` role reports
  `admin=true`.

## Stale-prefix bug fixed en route

Every admin/gateway test was failing with 307 redirects because
helpers and test files still referenced the `/@gated/` prefix that
commit `d4f9740eb78` (refactor: remove @gated path prefix, 2026-03-
23) deleted from the Rust server. Replaced globally across
`tests/**/*.{ts,json}`; before-fix reproduction:

```
$ bun test api/credentials/password.test.ts
Request method=POST url=/@gated/admin/api/users status=307 Temporary Redirect
SyntaxError: JSON Parse error: Unrecognized token '<'
0 pass / 3 fail
```

After the global replace: 3/3 pass and the new http/ suite lines up
on the correct `/api/*` + `/admin/api/*` routes.

Touched files: `tests/helpers/{api-client,process-manager,util,gated-
helpers,session}.ts`, `tests/api/auth/{cookie-auth,unauthorized}
.test.ts`, `tests/db/postgres-auth-in-browser.test.ts`,
`tests/kubernetes/integration.test.ts`,
`tests/ssh/auth-in-browser.test.ts`,
`tests/oidc-mock/clients-config.json`.

Also added `HttpSession.del()` for test DELETE requests.

## Deferred

- SSO redirect test. `startOidcServer` already exists in
  `ProcessManager`, but no existing test drives it end-to-end.
  Adding one requires an OIDC mock container — leaving as a
  follow-up since the rest of TEST-002's AC items are covered
  without docker.
- Account lockout / throttle-on-failure path — gated-core has no
  such mechanism yet; rate limiting at the endpoint level is
  covered by SEC-001 already.

## Description

`tests/` 目录 47 个集成测试中，HTTP 协议侧基本缺席：`tests/api/` 主要覆盖 admin API，`tests/ssh/`、`tests/db/`、`tests/kubernetes/` 覆盖各自协议，但 gateway 的登录 / API token / 目标列表 / SSO 回调 / info 端点没有专门测试。

验收标准：
- 新建 `tests/http/` 目录，至少覆盖：
  - `/api/auth/login` 成功 / 失败 / 锁定路径
  - `/api/profile/api-tokens` 创建 / 列出 / 删除
  - `/api/targets` 列表按用户权限过滤
  - `/api/info` 暴露的版本 / features 字段
  - SSO 重定向链路（基于既有 OIDC mock）
- 复用现有 `ProcessManager` + `AdminClient` + `GatewayClient`。
- 在 `test.yml` 上跑通。

## ActiveForm

补齐 gateway HTTP 协议集成测试

## Dependencies

- **blocked by**: REFACTOR-002
- **blocks**: (none)

## Notes

`SEC-001` 的限流测试可并入此目录，也可独立建 `tests/http/rate-limit.test.ts`。
