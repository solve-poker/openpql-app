use axum::{
    Router,
    routing::{get, post},
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod dto;
mod routes;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let app = Router::new()
        .route("/api/health", get(routes::health))
        .route("/api/games", get(routes::games))
        .route("/api/parse", post(routes::parse))
        .route("/api/validate-range", post(routes::validate_range))
        .route("/api/run", get(routes::run_ws))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "127.0.0.1:7878".parse()?;
    tracing::info!("open-pql-daemon listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
