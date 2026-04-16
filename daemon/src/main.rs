use axum::{
    Router,
    http::{HeaderValue, Method},
    routing::{get, post},
};
use std::net::SocketAddr;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod dto;
mod routes;

/// Allowed browser origins for both CORS and WebSocket upgrades.
/// Dev-only: the UI runs on Vite at 5173 on loopback. Any other origin
/// (including missing Origin for WS) is rejected.
pub const ALLOWED_ORIGINS: &[&str] = &[
    "http://127.0.0.1:5173",
    "http://localhost:5173",
];

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    // Origin policy:
    // - HTTP: explicit AllowOrigin list for browser CORS. Non-browser clients
    //   (curl, `just smoke`) send no Origin and browsers don't enforce CORS on
    //   them, so they still work.
    // - WS:   we additionally inspect the Origin header inside the upgrade
    //   handler and reject missing/disallowed origins with 403. See routes.rs.
    let origins: Vec<HeaderValue> = ALLOWED_ORIGINS
        .iter()
        .map(|o| HeaderValue::from_static(o))
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/api/health", get(routes::health))
        .route("/api/games", get(routes::games))
        .route("/api/parse", post(routes::parse))
        .route("/api/validate-range", post(routes::validate_range))
        .route("/api/run", get(routes::run_ws))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "127.0.0.1:7878".parse()?;
    tracing::info!("open-pql-daemon listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
