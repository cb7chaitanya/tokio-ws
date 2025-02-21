mod channel;
mod websocket;
mod server;

#[tokio::main]
async fn main() {
    server::run_server().await;
}