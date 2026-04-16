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

# Build wasm bundle into ui/src/wasm-pkg/
build-wasm:
    cd wasm && bash build.sh

# Install wasm-pack if missing (idempotent)
install-wasm-pack:
    @which wasm-pack > /dev/null || cargo install wasm-pack

# Full production build: wasm + UI
build-prod: install-wasm-pack build-wasm build-ui

# Deploy to Cloudflare Pages (preview branch)
deploy-preview: build-prod
    wrangler pages deploy ui/dist --project-name openpql-playground --branch preview

# Deploy to Cloudflare Pages (production)
deploy: build-prod
    wrangler pages deploy ui/dist --project-name openpql-playground --branch main

# Type/lint checks
check:
    cd daemon && cargo check
    @rustup target list --installed | grep -q wasm32-unknown-unknown && (cd wasm && cargo check --target wasm32-unknown-unknown) || echo "[skip] wasm32 target not installed; run: rustup target add wasm32-unknown-unknown"
    cd ui && bun run build

# Clean build artifacts
clean:
    cd daemon && cargo clean
    cd wasm && cargo clean 2>/dev/null || true
    rm -rf ui/dist ui/node_modules ui/src/wasm-pkg

# Smoke-test the daemon REST endpoints (daemon must be running)
smoke:
    curl -s localhost:7878/api/health
    @echo
    curl -s localhost:7878/api/games
    @echo
