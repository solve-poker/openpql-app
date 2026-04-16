// Ambient declarations for the wasm-bindgen-generated package at
// ui/src/wasm-pkg/openpql_wasm.js. The directory is produced by
// `just build-wasm` (Agent 1) and may not exist on a fresh checkout.
// We declare both the exact relative specifier (from ui/src/api/) and a
// wildcard so imports from ui/src/workers/ resolve too.

interface OpenPqlWasmModule {
  default(): Promise<void>;
  parse_pql(src: string):
    | { ok: true; stmts: number }
    | { ok: false; message: string };
  validate_range(
    game: string,
    text: string,
  ): { ok: true } | { ok: false; message: string };
  games(): string[];
  Run: {
    new (
      src: string,
      onLine: (kind: "stdout" | "stderr", line: string) => void,
      onDone: (err: string | null) => void,
    ): { cancel(): void; free(): void };
  };
}

declare module "*/wasm-pkg/openpql_wasm.js" {
  const mod: OpenPqlWasmModule;
  export default mod.default;
  export const parse_pql: OpenPqlWasmModule["parse_pql"];
  export const validate_range: OpenPqlWasmModule["validate_range"];
  export const games: OpenPqlWasmModule["games"];
  export const Run: OpenPqlWasmModule["Run"];
}
