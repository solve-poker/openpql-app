default:
    @just --list

# Install UI dependencies
install:
    cd ui && bun install

# Run daemon (127.0.0.1:7878) and UI dev server (127.0.0.1:5173) together
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    (cd daemon && cargo run) &
    (cd ui && bun run dev) &
    wait

# Run daemon only
dev-daemon:
    cd daemon && cargo run

# Run UI dev server only
dev-ui:
    cd ui && bun run dev

# Build both
build: build-daemon build-ui

build-daemon:
    cd daemon && cargo build --release

build-ui:
    cd ui && bun run build

# Type/lint checks
check:
    cd daemon && cargo check
    cd ui && bun run build

# Clean build artifacts
clean:
    cd daemon && cargo clean
    rm -rf ui/dist ui/node_modules

# Smoke-test the daemon REST endpoints (daemon must be running)
smoke:
    curl -s localhost:7878/api/health
    @echo
    curl -s localhost:7878/api/games
    @echo
