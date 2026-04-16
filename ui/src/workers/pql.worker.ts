// PQL Web Worker — loads the wasm module and runs PQL queries, streaming
// stdout/stderr lines back to the main thread using the same JSON message
// shapes as the daemon's ServerMsg/ClientMsg (see daemon/src/dto.rs).

import init, { Run } from "../wasm-pkg/openpql_wasm.js";

type ClientMsg =
  | { type: "run"; src: string; runId?: number }
  | { type: "cancel" };

type ServerMsg =
  | { type: "started"; runId?: number }
  | { type: "stdout"; line: string; runId?: number }
  | { type: "stderr"; line: string; runId?: number }
  | { type: "done"; runId?: number }
  | { type: "error"; message: string; runId?: number };

const ctx: {
  postMessage: (msg: unknown) => void;
  onmessage: ((ev: MessageEvent<ClientMsg>) => void) | null;
} = self as unknown as {
  postMessage: (msg: unknown) => void;
  onmessage: ((ev: MessageEvent<ClientMsg>) => void) | null;
};

let initPromise: Promise<unknown> | null = null;
let currentRun: InstanceType<typeof Run> | null = null;
let currentRunId: number | undefined = undefined;

function post(msg: ServerMsg): void {
  ctx.postMessage(msg);
}

function ensureInit(): Promise<unknown> {
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

function clearCurrent(): void {
  if (currentRun) {
    try {
      currentRun.free();
    } catch {
      // ignore double-free / already-freed
    }
  }
  currentRun = null;
  currentRunId = undefined;
}

async function handleRun(src: string, runId?: number): Promise<void> {
  try {
    await ensureInit();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", message, runId });
    return;
  }

  // If a run is already in progress, cancel it before starting a new one.
  if (currentRun) {
    try {
      currentRun.cancel();
    } catch {
      // ignore
    }
    clearCurrent();
  }

  post({ type: "started", runId });

  try {
    currentRunId = runId;
    currentRun = new Run(
      src,
      (kind: "stdout" | "stderr", line: string) => {
        post({ type: kind, line, runId: currentRunId });
      },
      (err: string | null) => {
        const id = currentRunId;
        if (err == null) {
          post({ type: "done", runId: id });
        } else {
          post({ type: "error", message: err, runId: id });
        }
        clearCurrent();
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", message, runId });
    clearCurrent();
  }
}

function handleCancel(): void {
  if (currentRun) {
    try {
      currentRun.cancel();
    } catch {
      // cancel may be a no-op or throw if already done; ignore
    }
  }
}

ctx.onmessage = (ev: MessageEvent<ClientMsg>) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  switch (msg.type) {
    case "run":
      void handleRun(msg.src, msg.runId);
      break;
    case "cancel":
      handleCancel();
      break;
    default:
      // Unknown message — ignore.
      break;
  }
};
