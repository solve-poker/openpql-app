PQL worker — runs PQL queries via wasm off the main thread.

Incoming (main to worker): `{type:"run", src, runId?}` | `{type:"cancel"}`.
Outgoing (worker to main): `{type:"started"|"stdout"|"stderr"|"done"|"error", ...}` — mirrors daemon's `ServerMsg` (see `daemon/src/dto.rs`).
Instantiate with: `new Worker(new URL("./pql.worker.ts", import.meta.url), {type:"module"})`.
Wasm is loaded lazily on first `run` and cached for the worker's lifetime.
