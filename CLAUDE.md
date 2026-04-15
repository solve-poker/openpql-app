# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Web app for the Open PQL (Poker Query Language) runner. Two components:

- `daemon/` — Rust (axum) HTTP+WebSocket server on `127.0.0.1:7878` that wraps the `openpql-runner` and related crates from the sibling `../../open-pql/` workspace.
- `ui/` — Vue 3 + Vite + TypeScript + Tailwind + Pinia SPA on `127.0.0.1:5173` that talks to the daemon.

The daemon depends on local path crates in `../../open-pql/` (`openpql-runner`, `openpql-pql-parser`, `openpql-range-parser`, `openpql-prelude`). Those must exist alongside this project.

## Commands (via `just`)

- `just dev` — run daemon + UI together (spawns both; `trap 'kill 0' EXIT`).
- `just dev-daemon` / `just dev-ui` — run one side only.
- `just build` — release build both (`cargo build --release`, `vite build`).
- `just check` — `cargo check` + `vue-tsc --noEmit && vite build` (UI's `build` script is the typecheck).
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
- `routes.rs` — handler bodies; uses `PQLRunner` from the sibling crate.
- `dto.rs` — request/response types shared via serde.

### UI (`ui/src/`)
- `api/rest.ts`, `api/ws.ts` — daemon clients (REST + WebSocket for `/api/run`).
- `stores/` — Pinia stores (`run.ts`, `history.ts`); history uses `pinia-plugin-persistedstate`.
- `components/` — `QueryEditor` (CodeMirror 6), `RangeGrid`, `CardPicker`, `ResultsPane`, `HistoryPane`.
- `pql/highlight.ts` — CodeMirror language/highlighting for PQL.

Data flow: editor → REST validate → WS `/api/run` streams → `run` store → `ResultsPane`; completed runs persist to `history` store.
