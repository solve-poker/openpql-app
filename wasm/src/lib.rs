//! WebAssembly bindings for the Open PQL runner.
//!
//! Mirrors the daemon's HTTP/WS API as wasm-bindgen callable functions:
//!
//! - `parse_pql(src)` -> `{ok: true, stmts}` | `{ok: false, message}`
//! - `validate_range(game, text)` -> `{ok: true}` | `{ok: false, message}`
//! - `games()` -> `["holdem", "omaha", "shortdeck"]`
//! - `Run::new(src, on_line, on_done)` — runs synchronously on the
//!   calling (worker) thread, then invokes the callbacks.
//!
//! ### Cancellation
//! Wasm in the browser has no preemption, and `PQLRunner::run` is blocking
//! and synchronous. `Run::cancel()` merely flips an internal flag; by the
//! time JS can call it, the run has already returned (since the whole run
//! executed inside the `Run::new` constructor on the same thread). If you
//! need to interrupt a long run, host the Run inside a Web Worker and
//! terminate the worker from the main thread.

use opql::PQLRunner;
use openpql_pql_parser::parse_pql as pql_parse;
use openpql_range_parser::parse_expr;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn __start() {
    #[cfg(feature = "debug-panics")]
    console_error_panic_hook::set_once();
}

#[derive(Serialize)]
#[serde(tag = "ok")]
enum ParseResp {
    #[serde(rename = "true")]
    Ok { stmts: usize },
    #[serde(rename = "false")]
    Err { message: String },
}

#[derive(Serialize)]
#[serde(tag = "ok")]
enum RangeResp {
    #[serde(rename = "true")]
    Ok,
    #[serde(rename = "false")]
    Err { message: String },
}

fn to_js<T: Serialize>(v: &T) -> JsValue {
    serde_wasm_bindgen::to_value(v).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn parse_pql(src: &str) -> JsValue {
    let resp = match pql_parse(src) {
        Ok(stmts) => ParseResp::Ok { stmts: stmts.len() },
        Err(e) => ParseResp::Err {
            message: format!("{e:?}"),
        },
    };
    to_js(&resp)
}

#[wasm_bindgen]
pub fn validate_range(game: &str, text: &str) -> JsValue {
    let is_shortdeck = game.eq_ignore_ascii_case("shortdeck");
    let resp = match parse_expr(is_shortdeck, text) {
        Ok(_) => RangeResp::Ok,
        Err(e) => RangeResp::Err {
            message: format!("{e:?}"),
        },
    };
    to_js(&resp)
}

#[wasm_bindgen]
pub fn games() -> JsValue {
    to_js(&["holdem", "omaha", "shortdeck"])
}

/// A single blocking PQL run. The run happens entirely inside `new()`:
/// stdout/stderr are captured, then streamed to `on_line`, then `on_done`
/// is fired. `cancel()` is a best-effort flag and cannot interrupt a run
/// in progress on the same thread — host in a Web Worker for real cancel.
#[wasm_bindgen]
pub struct Run {
    cancelled: bool,
}

#[wasm_bindgen]
impl Run {
    #[wasm_bindgen(constructor)]
    pub fn new(src: String, on_line: &js_sys::Function, on_done: &js_sys::Function) -> Run {
        let this = JsValue::NULL;
        let mut out = Vec::<u8>::new();
        let mut err = Vec::<u8>::new();
        let run_result = PQLRunner::run(&src, &mut out, &mut err);

        let stdout_tag = JsValue::from_str("stdout");
        let stderr_tag = JsValue::from_str("stderr");

        for line in String::from_utf8_lossy(&out).lines() {
            let _ = on_line.call2(&this, &stdout_tag, &JsValue::from_str(line));
        }
        for line in String::from_utf8_lossy(&err).lines() {
            let _ = on_line.call2(&this, &stderr_tag, &JsValue::from_str(line));
        }

        match run_result {
            Ok(()) => {
                let _ = on_done.call1(&this, &JsValue::NULL);
            }
            Err(e) => {
                let msg = format!("runner error: {e:?}");
                let _ = on_done.call1(&this, &JsValue::from_str(&msg));
            }
        }

        Run { cancelled: false }
    }

    /// No-op flag. See struct docs: in-thread cancellation is not possible
    /// because the run has already completed synchronously by the time JS
    /// regains control.
    pub fn cancel(&mut self) {
        self.cancelled = true;
    }
}
