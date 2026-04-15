export type ServerMsg =
  | { type: "started" }
  | { type: "stdout"; line: string }
  | { type: "stderr"; line: string }
  | { type: "done" }
  | { type: "error"; message: string };

export class RunClient {
  private ws: WebSocket | null = null;
  constructor(private onMsg: (m: ServerMsg) => void) {}

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}/api/run`);
    this.ws.onmessage = (e) => {
      try { this.onMsg(JSON.parse(e.data)); } catch {}
    };
    this.ws.onclose = () => { this.ws = null; };
  }

  run(src: string) {
    this.connect();
    const send = () => this.ws?.send(JSON.stringify({ type: "run", src }));
    if (this.ws?.readyState === WebSocket.OPEN) send();
    else this.ws?.addEventListener("open", send, { once: true });
  }

  cancel() {
    this.ws?.send(JSON.stringify({ type: "cancel" }));
  }

  close() { this.ws?.close(); this.ws = null; }
}
