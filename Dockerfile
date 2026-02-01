# FHE Raffle Builder Docker
# Uses latest Rust nightly with edition2024 support for FHE programs

FROM rust:nightly as builder

# Install Solana tools
RUN curl -sSf https://release.solana.com/v1.18.18/install | sh
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files first (for better layer caching)
COPY Cargo.toml Cargo.lock ./
COPY programs/ ./programs/

# Build specific program (passed as build arg)
ARG PROGRAM_NAME
RUN echo "Building program: ${PROGRAM_NAME}" && \
    cargo build-sbf --manifest-path programs/${PROGRAM_NAME}/Cargo.toml --release

# Deployment stage
FROM ubuntu:22.04

# Install Solana CLI for deployment
RUN apt-get update && apt-get install -y curl && \
    curl -sSf https://release.solana.com/v1.18.18/install | sh && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Copy built program
ARG PROGRAM_NAME
COPY --from=builder /app/target/deploy/${PROGRAM_NAME}.so /app/program.so

# Copy keypair if it exists
ARG PROGRAM_ID
COPY --from=builder /app/target/deploy/${PROGRAM_ID}-keypair.json /app/keypair.json 2>/dev/null || true

WORKDIR /app

# Default command shows help
CMD ["echo", "Use docker run with proper environment variables to deploy"]
