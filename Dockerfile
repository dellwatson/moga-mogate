# Aleo Development & Deployment Dockerfile
FROM rust:1.90-slim-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    clang \
    && rm -rf /var/lib/apt/lists/*

# Install Leo from crates.io
RUN cargo install leo-lang

# Verify Leo installation
RUN leo --version

# Set working directory
WORKDIR /workspace

# Copy project files
COPY . .

# Default command
CMD ["/bin/bash"]
