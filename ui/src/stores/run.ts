import { defineStore } from "pinia";
import { RunClient, type ServerMsg } from "../api/ws";

export const useRun = defineStore("run", {
  state: () => ({
    running: false,
    stdout: [] as string[],
    stderr: [] as string[],
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
      if (m.type === "started") {
        this.running = true;
        this.stdout = [];
        this.stderr = [];
      } else if (m.type === "stdout") {
        this.stdout.push(m.line);
      } else if (m.type === "stderr") {
        this.stderr.push(m.line);
      } else if (m.type === "done") {
        this.running = false;
      } else if (m.type === "error") {
        this.stderr.push(`[error] ${m.message}`);
        this.running = false;
      }
    },
    run(src: string) {
      this.ensureClient().run(src);
    },
    cancel() {
      this.client?.cancel();
    },
  },
});
