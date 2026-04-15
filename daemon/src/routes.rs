use crate::dto::*;
use axum::{
    Json,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
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

pub async fn run_ws(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_ws)
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
                    Ok(ClientMsg::Run { src }) => {
                        if let Some(c) = cancel_tx.take() { let _ = c.send(()); }
                        let (ctx, crx) = tokio::sync::oneshot::channel();
                        cancel_tx = Some(ctx);
                        let tx2 = tx.clone();
                        let _ = tx2.send(ServerMsg::Started);
                        tokio::spawn(async move {
                            run_and_stream(src, tx2, crx).await;
                        });
                    }
                    Ok(ClientMsg::Cancel) => {
                        if let Some(c) = cancel_tx.take() { let _ = c.send(()); }
                    }
                    Err(e) => {
                        let _ = tx.send(ServerMsg::Error {
                            message: format!("bad client message: {e}"),
                        });
                    }
                }
            }
        }
    }
}

async fn run_and_stream(
    src: String,
    tx: mpsc::UnboundedSender<ServerMsg>,
    mut cancel: tokio::sync::oneshot::Receiver<()>,
) {
    // Blocking runner on a dedicated thread; cancel short-circuits the wait.
    let (done_tx, done_rx) = tokio::sync::oneshot::channel();
    let tx_worker = tx.clone();
    std::thread::spawn(move || {
        let mut out = Vec::<u8>::new();
        let mut err = Vec::<u8>::new();
        let _ = PQLRunner::run(&src, &mut out, &mut err);
        for line in String::from_utf8_lossy(&out).lines() {
            let _ = tx_worker.send(ServerMsg::Stdout { line: line.to_string() });
        }
        for line in String::from_utf8_lossy(&err).lines() {
            let _ = tx_worker.send(ServerMsg::Stderr { line: line.to_string() });
        }
        let _ = done_tx.send(());
    });

    tokio::select! {
        _ = &mut cancel => {
            let _ = tx.send(ServerMsg::Error { message: "cancelled".into() });
        }
        _ = done_rx => {
            let _ = tx.send(ServerMsg::Done);
        }
    }
}
