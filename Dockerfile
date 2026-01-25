# Use Rust 1.85 stable as base (released Dec 2024, has modern cargo)
FROM rust:1.85

# Install very recent nightly that supports edition2024
RUN rustup toolchain install nightly-2025-01-20 && \
    rustup default nightly-2025-01-20 && \
    rustup target add wasm32-unknown-unknown

# Clear contaminated cargo registry cache
RUN rm -rf /usr/local/cargo/registry

WORKDIR /contracts

# Copy the new contract directories
COPY contracts/cspr_transfer_proxy /contracts/cspr_transfer_proxy
COPY contracts/cspr_transfer_proxy_contract_purse /contracts/cspr_transfer_proxy_contract_purse

# Build both contracts with fresh registry
RUN cd /contracts/cspr_transfer_proxy && cargo build --release --target wasm32-unknown-unknown
RUN cd /contracts/cspr_transfer_proxy_contract_purse && cargo build --release --target wasm32-unknown-unknown

# Copy WASM files to output
RUN mkdir -p /output && \
    cp /contracts/cspr_transfer_proxy/target/wasm32-unknown-unknown/release/cspr_transfer_proxy.wasm /output/ && \
    cp /contracts/cspr_transfer_proxy_contract_purse/target/wasm32-unknown-unknown/release/cspr_transfer_contract_purse.wasm /output/

WORKDIR /output
CMD ["ls", "-la"]
