export type ServerMsg =
  | { type: "started"; runId?: number }
  | { type: "stdout"; line: string; runId?: number }
  | { type: "stderr"; line: string; runId?: number }
  | { type: "done"; runId?: number }
  | { type: "error"; message: string; runId?: number };

export class RunClient {
  private ws: WebSocket | null = null;
  private currentRunId: number | undefined = undefined;
  private inFlight = false;
  constructor(private onMsg: (m: ServerMsg) => void) {}

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/api/run`);
    this.ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data) as ServerMsg;
        if (m && (m.type === "done" || m.type === "error")) {
          this.inFlight = false;
        }
        this.onMsg(m);
      } catch {}
    };
    this.ws.onerror = () => {
      if (this.inFlight) {
        this.inFlight = false;
        this.onMsg({ type: "error", message: "connection lost", runId: this.currentRunId });
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      if (this.inFlight) {
        this.inFlight = false;
        this.onMsg({ type: "error", message: "connection lost", runId: this.currentRunId });
      }
    };
  }

  run(src: string, runId: number) {
    this.connect();
    this.currentRunId = runId;
    this.inFlight = true;
    const send = () => this.ws?.send(JSON.stringify({ type: "run", src, runId }));
    if (this.ws?.readyState === WebSocket.OPEN) send();
    else this.ws?.addEventListener("open", send, { once: true });
  }

  cancel() {
    this.inFlight = false;
    this.ws?.send(JSON.stringify({ type: "cancel" }));
  }

  close() { this.ws?.close(); this.ws = null; }
}
