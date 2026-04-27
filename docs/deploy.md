# Gated Deployment Notes

## Local Test Service

The local test service runs in a tmux session name derived from the
repository path:

```bash
WD=/srv/ai/gated
SESSION=$(basename "$WD" | tr '.' '-')-$(echo -n "$WD" | md5sum | cut -c1-6)
```

For this repository, the tmux session name is:

```bash
gated-06b41d
```

Attach with:

```bash
tmux attach -t gated-06b41d
```

The service uses `config.yaml` and the debug binary built for
`x86_64-unknown-linux-gnu`:

```bash
target/x86_64-unknown-linux-gnu/debug/gated --config config.yaml run
```

## Rebuild And Restart

Use this flow when asked to rebuild, package, and restart the tmux test
service.

1. Build the frontend assets:

```bash
/root/.bun/bin/bun run build
```

Run this from `crates/gated-web`. If `bun` is already on `PATH`, plain
`bun run build` is fine.

2. Compile the Rust workspace with the same target/features used by the
test service:

```bash
cargo build --all-features -j 4 --target x86_64-unknown-linux-gnu
```

Run this from the repository root.

3. Restart the tmux service:

```bash
WD=/srv/ai/gated
SESSION=$(basename "$WD" | tr '.' '-')-$(echo -n "$WD" | md5sum | cut -c1-6)
tmux send-keys -t "$SESSION":0 C-c
tmux new-session -d -s "$SESSION" -c "$WD" \
  'bash -lc "export RUST_BACKTRACE=1; exec target/x86_64-unknown-linux-gnu/debug/gated --config config.yaml run 2>&1 | tee /tmp/gated.log"'
```

If `tmux send-keys` closes the old session, recreate it with the
`tmux new-session` command above.

## Verification

After restart, confirm the service is listening:

```bash
WD=/srv/ai/gated
SESSION=$(basename "$WD" | tr '.' '-')-$(echo -n "$WD" | md5sum | cut -c1-6)
tmux capture-pane -pt "$SESSION":0 -S -80
curl -skI https://127.0.0.1:8890/api/info
```

Expected HTTP probe result:

```text
HTTP/2 200
```

Default local listeners:

| Protocol | Port |
|----------|------|
| HTTP | 8890 |
| SSH | 2222 |
| MySQL | 33306 |
| PostgreSQL | 35432 |
| Kubernetes | 36443 |

## Notes

- Do not change unrelated working-tree files during deployment.
- Existing tmux logs are also written to `/tmp/gated.log` when using the
  command above.
- Frontend build may warn about large Vite chunks; that warning is
  currently expected unless accompanied by a build failure.
