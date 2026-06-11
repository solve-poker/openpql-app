# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Web app for the Open PQL (Poker Query Language) runner. Two components:

- `daemon/` — Rust (axum) HTTP+WebSocket server on `127.0.0.1:7878` that wraps the `openpql-runner` and related crates from crates.io, pinned to an exact version (`=x.y.z`) in both `daemon/Cargo.toml` and `wasm/Cargo.toml` — keep the two in sync when bumping.
- `ui/` — Vue 3 + Vite + TypeScript + Tailwind + Pinia SPA on `localhost:5173` that talks to the daemon. Vite dev mode proxies `/api` to the daemon, so the daemon must be running (use `just dev`, which starts both).

## Commands (via `just`)

- `just dev` — run daemon + UI together (spawns both; `trap 'kill 0' EXIT`).
- `just dev-daemon` / `just dev-ui` — run one side only.
- `just check` — `cargo check` (daemon + wasm) + `vue-tsc --noEmit && vite build` (UI's `build` script is the typecheck).
- `just build-prod` — production build (wasm + static UI); `just deploy` / `just deploy-preview` push it to Cloudflare Pages.
- `just install` — `bun install` in `ui/`.
- `just smoke` — curl `/api/health` and `/api/games` (daemon must be running).

UI uses **bun** (not npm/pnpm). Rust edition is **2024**.

## Architecture

### Daemon (`daemon/src/`)
- `main.rs` — axum router, CORS permissive, routes:
  - `GET /api/health`, `GET /api/games`
  - `POST /api/parse` — wraps `parse_pql`
  - `POST /api/validate-range` — wraps `parse_expr` (shortdeck flag derived from `game`)
  - `GET /api/run` — WebSocket; streams runner progress/results via `tokio::sync::mpsc`
- `routes.rs` — handler bodies; uses `PQLRunner` from the `openpql-runner` crate.
- `dto.rs` — request/response types shared via serde.

### UI (`ui/src/`)
- `api/rest.ts`, `api/ws.ts` — daemon clients (REST + WebSocket for `/api/run`).
- `stores/` — Pinia stores (`run.ts`, `history.ts`); history uses `pinia-plugin-persistedstate`.
- `components/` — `QueryEditor` (CodeMirror 6), `RangeGrid`, `CardPicker`, `ResultsPane`, `HistoryPane`.
- `pql/highlight.ts` — CodeMirror language/highlighting for PQL.

Data flow: editor → REST validate → WS `/api/run` streams → `run` store → `ResultsPane`; completed runs persist to `history` store.

## WASM / Cloudflare build

Two runtime modes: **daemon** (local dev, full WS streaming) and **WASM** (production, fully static — no server).

- The UI selects the backend automatically via `import.meta.env.DEV`, with `VITE_API_BACKEND` (`daemon` | `wasm`) as an override. See `ui/src/api/index.ts`.
- `wasm/` is a Rust `cdylib` crate built with `wasm-pack` (`wasm/build.sh` → `ui/src/wasm-pkg/`). The module is loaded from the main thread for parse/validate and from `ui/src/workers/pql.worker.ts` for `run` (heavy Monte-Carlo work off the main thread).
- Deployment target: **Cloudflare Pages**, static-only — no server-side code. Config lives in `wrangler.toml`, headers/redirects in `ui/public/_headers` and `ui/public/_redirects`. See `deploy/README.md`.
- Dev flow unchanged: `just dev`. Prod build: `just build-prod` (installs `wasm-pack` if missing, builds wasm, then `vite build`). Deploy: `just deploy-preview` / `just deploy`.
- `just check` will `cargo check` the wasm crate against `wasm32-unknown-unknown` if that target is installed, otherwise skip with a hint.
- openpql ≥0.2.1 is wasm-safe: the runner clamps to a single thread under `cfg!(target_family = "wasm")` (threads would panic on wasm32). Before bumping the pinned version, confirm upstream kept that guard.
