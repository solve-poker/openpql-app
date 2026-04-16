# openpql-wasm

WebAssembly bindings that expose the same surface as `daemon/` directly in
the browser. Lets the UI run PQL queries without a local daemon.

## Prerequisites

```bash
cargo install wasm-pack
rustup target add wasm32-unknown-unknown
```

## Build

```bash
./build.sh
# -> emits to ../ui/src/wasm-pkg
```

## API

```ts
import init, { parse_pql, validate_range, games, Run } from "./wasm-pkg";
await init();

parse_pql("select ...");                 // {ok:true, stmts} | {ok:false, message}
validate_range("holdem", "AA,KK");       // {ok:true}        | {ok:false, message}
games();                                 // ["holdem","omaha","shortdeck"]

new Run(src, (kind, line) => {           // kind = "stdout" | "stderr"
  console.log(kind, line);
}, (err) => {                            // null on success, string on error
  if (err) console.error(err);
});
```

## Sibling crate compatibility

`openpql-runner` (aka `opql`) does **not** use `tokio`, `rayon`,
`std::thread`, `std::fs`, or `std::net`. It does use `rand`, which
depends on `getrandom`. This crate enables `getrandom`'s `js` feature
so the browser's Web Crypto API is used — no extra patching of the
sibling crate required.

## Cancellation caveat

The daemon runs PQL on a dedicated OS thread and cancels via oneshot.
Wasm has no preemption and `PQLRunner::run` is synchronous, so the run
completes entirely inside `new Run(...)` before JS regains control.
`Run::cancel()` is therefore a flag-only stub. For real cancel, host the
`Run` inside a Web Worker and terminate the worker from the main thread.

## Verifying

```bash
cargo check --target wasm32-unknown-unknown
```
