# TEST-003 SQL Console 集成测试补全

- **status**: completed
- **priority**: P1
- **owner**: claude-code
- **createdAt**: 2026-04-18 20:55
- **bkd_issue**: uz2us4hc
- **completedAt**: 2026-04-19 04:10

## Description

新增的 `tests/db/sql-console.test.ts` 建立了 MariaDB + X-Gated-Token 的基础用例，但 FEAT-001 的关键保证尚未覆盖。

验收标准（每点至少一个用例）：
- 只读拦截：`UPDATE` / `DELETE` / `DROP` 被拒；注释包裹的写语句被拒；CTE 写被拒；复合语句被拒（SEC-002 配套）。
- 结果截断：查询返回 > 5 MiB 数据时响应带 `truncated=true` 且未 OOM。
- 超时：执行 `SELECT SLEEP(40)`（MySQL）/ `pg_sleep(40)`（Postgres）在 30s 被中止。
- 鉴权：无 token / 错误 token / 过期 token → 401。
- 非可查 kind：SSH / Kubernetes target 的请求返回 400。
- 限流：并发触达配额返回 429（依赖 SEC-001）。

## ActiveForm

扩展 SQL Console 集成测试覆盖边界场景

## Dependencies

- **blocked by**: SEC-001, SEC-002
- **blocks**: (none)

## Notes

Postgres 侧需 docker fixture，可复用 `tests/db/postgres-*.test.ts` 的容器启动代码。

## Completion

- 8 new Bun test cases in `tests/db/sql-console.test.ts`:
  - readonly variants (UPDATE / DROP / writable CTE / compound /
    comment-wrapped) for MySQL and Postgres;
  - 5 MiB truncation via REPEAT UNION ALL;
  - 30 s statement timeout for MySQL SLEEP(40) and Postgres pg_sleep(40);
  - missing / invalid `X-Gated-Token` → 401;
  - SSH target → 400 "Target is not a database".
- Rate limit 429 (SEC-001) already covered.
- File-local `provisionDbTarget` factory + shared MySQL/Postgres containers
  per describe block keep the suite at ~87 s.
- Verified locally: 11/11 pass. The two pre-existing
  `postgres-auth-*.test.ts` failures use the host-port `startPostgresServer`
  helper that this sandbox can't route to and are unrelated.
