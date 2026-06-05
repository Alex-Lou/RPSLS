# ─────────────── Builder ───────────────
FROM rust:1.95-bookworm AS builder

WORKDIR /app

# Build tools for reqwest's TLS backend. Cargo.lock resolves rustls → *ring*,
# whose build needs a C compiler + perl to assemble its crypto; cmake/clang/
# pkg-config are harmless insurance for any other crypto path. The C compiler
# ships with the rust image; the rest we add here. (Builder image is discarded,
# so this doesn't bloat the runtime.) Without these the release build exits 1.
RUN apt-get update \
 && apt-get install -y --no-install-recommends perl make pkg-config cmake clang libclang-dev \
 && rm -rf /var/lib/apt/lists/*

# Build only the server + its core dependency. We create a minimal workspace
# Cargo.toml on the fly to avoid pulling in the Tauri app crate (which has
# OS-specific native deps that won't build on a Linux server image).
COPY crates/rpsls-core ./crates/rpsls-core
COPY crates/rpsls-server ./crates/rpsls-server

RUN printf '%s\n' \
  '[workspace]' \
  'resolver = "2"' \
  'members = ["crates/rpsls-core", "crates/rpsls-server"]' \
  '' \
  '[workspace.package]' \
  'version = "0.1.0"' \
  'edition = "2021"' \
  'license = "MIT"' \
  'authors = ["Alex <alex.guennad@gmail.com>"]' \
  '' \
  '[workspace.dependencies]' \
  'serde = { version = "1", features = ["derive"] }' \
  'serde_json = "1"' \
  'rpsls-core = { path = "crates/rpsls-core" }' \
  > Cargo.toml

RUN cargo build --release -p rpsls-server

# ─────────────── Runtime ───────────────
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/rpsls-server /usr/local/bin/rpsls-server

ENV PORT=8080
EXPOSE 8080

CMD ["/usr/local/bin/rpsls-server"]
