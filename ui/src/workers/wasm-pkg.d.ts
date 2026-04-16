declare module "../wasm-pkg/openpql_wasm.js" {
  export default function init(): Promise<void>;
  export class Run {
    constructor(
      src: string,
      onLine: (kind: "stdout" | "stderr", line: string) => void,
      onDone: (err: string | null) => void,
    );
    cancel(): void;
    free(): void;
  }
}
