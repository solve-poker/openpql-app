use crate::dto::*;
use axum::{
    Json,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
};
use crate::ALLOWED_ORIGINS;
use opql::PQLRunner;
use openpql_pql_parser::parse_pql;
use openpql_range_parser::parse_expr;
use serde_json::json;
use tokio::sync::mpsc;

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({ "ok": true }))
}

pub async fn games() -> Json<serde_json::Value> {
    Json(json!({
        "games": ["holdem", "omaha", "shortdeck"],
        "streets": ["preflop", "flop", "turn", "river"],
    }))
}

pub async fn parse(Json(req): Json<ParseReq>) -> Json<ParseResp> {
    match parse_pql(&req.src) {
        Ok(stmts) => Json(ParseResp::Ok { stmts: stmts.len() }),
        Err(e) => Json(ParseResp::Err {
            message: format!("{e:?}"),
        }),
    }
}

pub async fn validate_range(Json(req): Json<RangeReq>) -> Json<RangeResp> {
    let is_shortdeck = req.game.eq_ignore_ascii_case("shortdeck");
    match parse_expr(is_shortdeck, &req.text) {
        Ok(_) => Json(RangeResp::Ok),
        Err(e) => Json(RangeResp::Err {
            message: format!("{e:?}"),
        }),
    }
}

pub async fn run_ws(headers: HeaderMap, ws: WebSocketUpgrade) -> axum::response::Response {
    // WS origin policy: stricter than HTTP. A missing Origin is rejected too,
    // because browser WS clients always send one. Non-browser WS tools can set
    // --origin http://127.0.0.1:5173 if they need access. This blocks
    // drive-by cross-site WS from random pages the user might visit.
    let origin = headers.get(axum::http::header::ORIGIN).and_then(|v| v.to_str().ok());
    let ok = match origin {
        Some(o) => ALLOWED_ORIGINS.iter().any(|a| *a == o),
        None => false,
    };
    if !ok {
        return (StatusCode::FORBIDDEN, "forbidden origin").into_response();
    }
    ws.on_upgrade(handle_ws).into_response()
}

async fn handle_ws(mut socket: WebSocket) {
    // Current in-flight run's cancel signal.
    let mut cancel_tx: Option<tokio::sync::oneshot::Sender<()>> = None;
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    loop {
        tokio::select! {
            Some(msg) = rx.recv() => {
                let json = serde_json::to_string(&msg).unwrap_or_default();
                if socket.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
            recv = socket.recv() => {
                let Some(Ok(frame)) = recv else { break };
                let text = match frame {
                    Message::Text(t) => t,
                    Message::Close(_) => break,
                    _ => continue,
                };
                let cmd: Result<ClientMsg, _> = serde_json::from_str(&text);
                match cmd {
                    Ok(ClientMsg::Run { src, run_id }) => {
                        if let Some(c) = cancel_tx.take() { let _ = c.send(()); }
                        let (ctx, crx) = tokio::sync::oneshot::channel();
                        cancel_tx = Some(ctx);
                        let tx2 = tx.clone();
                        let _ = tx2.send(ServerMsg::Started { run_id });
                        tokio::spawn(async move {
                            run_and_stream(src, run_id, tx2, crx).await;
                        });
                    }
                    Ok(ClientMsg::Cancel) => {
                        if let Some(c) = cancel_tx.take() { let _ = c.send(()); }
                    }
                    Err(e) => {
                        let _ = tx.send(ServerMsg::Error {
                            message: format!("bad client message: {e}"),
                            run_id: None,
                        });
                    }
                }
            }
        }
    }
}

async fn run_and_stream(
    src: String,
    run_id: Option<u64>,
    tx: mpsc::UnboundedSender<ServerMsg>,
    mut cancel: tokio::sync::oneshot::Receiver<()>,
) {
    // Blocking runner on a dedicated thread; cancel short-circuits the wait.
    let (done_tx, done_rx) = tokio::sync::oneshot::channel();
    let tx_worker = tx.clone();
    std::thread::spawn(move || {
        let mut out = Vec::<u8>::new();
        let mut err = Vec::<u8>::new();
        let run_result = PQLRunner::run(&src, &mut out, &mut err);
        for line in String::from_utf8_lossy(&out).lines() {
            let _ = tx_worker.send(ServerMsg::Stdout {
                line: line.to_string(),
                run_id,
            });
        }
        for line in String::from_utf8_lossy(&err).lines() {
            let _ = tx_worker.send(ServerMsg::Stderr {
                line: line.to_string(),
                run_id,
            });
        }
        if let Err(e) = run_result {
            let _ = tx_worker.send(ServerMsg::Error {
                message: format!("runner error: {e:?}"),
                run_id,
            });
        }
        let _ = done_tx.send(());
    });

    tokio::select! {
        _ = &mut cancel => {
            let _ = tx.send(ServerMsg::Error {
                message: "cancelled".into(),
                run_id,
            });
        }
        _ = done_rx => {
            let _ = tx.send(ServerMsg::Done { run_id });
        }
    }
}
