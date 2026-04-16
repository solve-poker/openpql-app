import { defineStore } from "pinia";
import { RunClient, type ServerMsg } from "../api/ws";

export interface PlayerResult {
  name: string;
  equity: number; // 0..1
  index: number;
}

let nextRunId = 1;

export const useRun = defineStore("run", {
  state: () => ({
    running: false,
    stdout: [] as string[],
    stderr: [] as string[],
    results: [] as PlayerResult[],
    trials: 0,
    successes: 0,
    startedAt: 0,
    elapsedMs: 0,
    error: "" as string,
    currentRunId: 0,
    client: null as RunClient | null,
  }),
  actions: {
    ensureClient() {
      if (!this.client) {
        this.client = new RunClient((m: ServerMsg) => this.onMsg(m));
      }
      return this.client;
    },
    onMsg(m: ServerMsg) {
      // Ignore stale runs.
      if (m.runId !== undefined && m.runId !== this.currentRunId) return;

      if (m.type === "started") {
        // No-op: we already set running optimistically.
      } else if (m.type === "stdout") {
        this.stdout.push(m.line);
        this.parseLine(m.line);
      } else if (m.type === "stderr") {
        this.stderr.push(m.line);
      } else if (m.type === "done") {
        this.elapsedMs = Date.now() - this.startedAt;
        this.running = false;
      } else if (m.type === "error") {
        this.stderr.push(`[error] ${m.message}`);
        this.elapsedMs = Date.now() - this.startedAt;
        this.error = m.message;
        this.running = false;
        // Drop any further stale frames from this run.
        this.currentRunId = nextRunId++;
      }
    },
    parseLine(line: string) {
      // Formats seen:
      //   "AVG 0 = 0.432"
      //   "p1 0 = 0.432"  (when aliased)
      //   "trials = 10000" / "n_succ = ..." etc.
      const eq = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+(\d+)\s*=\s*([-+0-9.eE]+)\s*$/);
      if (eq) {
        const label = eq[1];
        const idx = parseInt(eq[2], 10);
        const val = parseFloat(eq[3]);
        if (!Number.isNaN(val)) {
          const isGeneric = /^(avg|count|max|min)$/i.test(label);
          const name = isGeneric ? `p${idx + 1}` : label;
          const existing = this.results.find((r) => r.name === name);
          if (existing) {
            existing.equity = val;
            existing.index = idx;
          } else {
            this.results.push({ name, index: idx, equity: val });
            this.results.sort((a, b) => a.index - b.index);
          }
          return;
        }
      }
      const trialsM = line.match(/^\s*trials\s*=\s*(\d+)/);
      if (trialsM) {
        this.trials = parseInt(trialsM[1], 10);
        return;
      }
      const succM = line.match(/^\s*n_succ\s*=\s*(\d+)/);
      if (succM) {
        this.successes = parseInt(succM[1], 10);
      }
    },
    run(src: string) {
      this.running = true;
      this.stdout = [];
      this.stderr = [];
      this.results = [];
      this.trials = 0;
      this.successes = 0;
      this.error = "";
      this.startedAt = Date.now();
      this.elapsedMs = 0;
      this.currentRunId = nextRunId++;
      this.ensureClient().run(src, this.currentRunId);
    },
    cancel() {
      // Bump runId BEFORE sending cancel so any late stdout/done from the old
      // run are filtered out by the runId guard in onMsg.
      const wasRunning = this.running;
      this.currentRunId = nextRunId++;
      this.running = false;
      if (wasRunning) {
        this.elapsedMs = Date.now() - this.startedAt;
      }
      this.client?.cancel();
    },
  },
});
