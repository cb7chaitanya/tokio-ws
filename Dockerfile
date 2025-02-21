# Build stage
FROM rust:1.76-slim as builder

WORKDIR /usr/src/app
COPY . .

RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
WORKDIR /usr/local/bin
COPY --from=builder /usr/src/app/target/release/chat /usr/local/bin/chat

ENV PORT=8080
EXPOSE 8080

# Install necessary SSL certificates for WebSocket
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

CMD ["chat"]  