default:
    @just --list

# Install UI dependencies
install:
    cd ui && bun install

# Run daemon (127.0.0.1:7878) and UI dev server (localhost:5173) together
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

# Run UI dev server only (dev mode proxies /api to the daemon — start it too, or use `just dev`)
dev-ui:
    cd ui && bun run dev

# Build wasm bundle into ui/src/wasm-pkg/ (installs wasm-pack if missing)
build-wasm:
    @which wasm-pack > /dev/null || cargo install wasm-pack
    cd wasm && bash build.sh

# Full production build: wasm + static UI (Cloudflare Pages artifact in ui/dist)
build-prod: build-wasm
    cd ui && bun run build

# Deploy to Cloudflare Pages (preview branch)
deploy-preview: build-prod
    wrangler pages deploy ui/dist --project-name openpql-playground --branch preview

# Deploy to Cloudflare Pages (production)
deploy: build-prod
    wrangler pages deploy ui/dist --project-name openpql-playground --branch main

# Type/lint checks: daemon, wasm (if target installed), UI
check:
    cd daemon && cargo check
    @rustup target list --installed | grep -q wasm32-unknown-unknown && (cd wasm && cargo check --target wasm32-unknown-unknown) || echo "[skip] wasm32 target not installed; run: rustup target add wasm32-unknown-unknown"
    cd ui && bun run build

# Smoke-test the daemon REST endpoints (daemon must be running)
smoke:
    curl -s localhost:7878/api/health
    @echo
    curl -s localhost:7878/api/games
    @echo

# Clean build artifacts
clean:
    cd daemon && cargo clean
    cd wasm && cargo clean
    rm -rf ui/dist ui/node_modules ui/src/wasm-pkg
