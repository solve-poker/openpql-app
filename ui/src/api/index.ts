// Unified API facade. Selects between the daemon-backed implementation (dev)
// and the WASM-worker-backed implementation (production / Cloudflare).
//
// Selection:
//   - VITE_API_BACKEND=daemon|wasm overrides everything.
//   - Otherwise: import.meta.env.DEV → daemon, else → wasm.

import * as daemon from "./daemon";
import * as wasm from "./wasm";

type Backend = "daemon" | "wasm";

function pickBackend(): Backend {
  const override = (import.meta.env.VITE_API_BACKEND as string | undefined)?.toLowerCase();
  if (override === "daemon" || override === "wasm") return override;
  return import.meta.env.DEV ? "daemon" : "wasm";
}

const impl = pickBackend() === "wasm" ? wasm : daemon;

export type ServerMsg =
  | { type: "started"; runId?: number }
  | { type: "stdout"; line: string; runId?: number }
  | { type: "stderr"; line: string; runId?: number }
  | { type: "done"; runId?: number }
  | { type: "error"; message: string; runId?: number };

export const apiParse = impl.apiParse;
export const apiValidateRange = impl.apiValidateRange;
export const apiGames = impl.apiGames;
export const RunClient = impl.RunClient;
export type RunClient = InstanceType<typeof impl.RunClient>;
