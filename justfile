projects := "gated gated-admin gated-ca gated-common gated-core gated-database-protocols gated-db-entities gated-db-migrations gated-ldap gated-protocol-api gated-protocol-http gated-protocol-kubernetes gated-protocol-mysql gated-protocol-postgres gated-protocol-ssh gated-sso gated-tls gated-web"

run $RUST_BACKTRACE='1' *ARGS='run':
     cargo run --all-features -- --config config.yaml {{ARGS}}

fmt:
    for p in {{projects}}; do cargo fmt -p $p -v; done

fix *ARGS:
    for p in {{projects}}; do cargo fix --all-features -p $p {{ARGS}}; done

clippy *ARGS:
    for p in {{projects}}; do cargo cranky --all-features -p $p {{ARGS}}; done

test:
    for p in {{projects}}; do cargo test --all-features -p $p; done

bun *ARGS:
    cd crates/gated-web && bun {{ARGS}}

bunx *ARGS:
    cd crates/gated-web && bunx {{ARGS}}

migrate *ARGS:
    cargo run --all-features -p gated-db-migrations -- {{ARGS}}

lint *ARGS:
    cd crates/gated-web && bun run lint {{ARGS}}

typecheck:
    cd crates/gated-web && bun run typecheck

test-web:
    cd crates/gated-web && bun run test

i18n-check:
    cd crates/gated-web && bun run i18n-check

openapi-all:
    cd crates/gated-web && bun run openapi:schema:admin && bun run openapi:schema:gateway && bun run openapi:client:admin && bun run openapi:client:gateway

openapi:
    cd crates/gated-web && bun run openapi:client:admin && bun run openapi:client:gateway

config-schema:
    cargo run -p gated-common --bin config-schema > config-schema.json

cleanup: (fix "--allow-dirty") (clippy "--fix" "--allow-dirty") fmt typecheck lint i18n-check test-web

udeps:
    cargo udeps --all-features --all-targets
