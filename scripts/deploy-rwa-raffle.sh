#!/bin/bash

# Deploy the RWA raffle CSPR contract to Casper testnet
# Requires: casper-client, compiled wasm at target/wasm32-unknown-unknown/release/rwa_raffle_cspr.wasm

set -e

PEM_FILE="Account 1_secret_key.pem"
NODE_ADDRESS="http://49.12.85.57:7777"
CHAIN_NAME="casper-test"
WASM_PATH="./contracts/rwa_raffle/target/wasm32-unknown-unknown/release/rwa_raffle_cspr.wasm"
PAYMENT_AMOUNT="200000000000" # 200 CSPR for contract install

if [ ! -f "$WASM_PATH" ]; then
  echo "❌ WASM not found at $WASM_PATH"
  echo "   Build it first with: cargo build --release --target wasm32-unknown-unknown -p rwa_raffle_cspr"
  exit 1
fi

echo "🚀 Deploying RWA raffle CSPR contract..."

echo "🔨 Sending deploy..."
DEPLOY_OUTPUT=$(casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$PEM_FILE" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" 2>&1)

echo "$DEPLOY_OUTPUT"

echo ""
# casper-client 5.x prints JSON with a "deploy_hash":"<64-hex>" field.
# Extract the 64-hex hash value with sed, no jq dependency.
DEPLOY_HASH=$(echo "$DEPLOY_OUTPUT" | sed -n 's/.*"deploy_hash"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{64\}\)".*/\1/p' | head -1)

if [ -z "$DEPLOY_HASH" ]; then
  echo "❌ Failed to extract deploy hash"
  exit 1
fi

echo "✅ Deploy submitted: $DEPLOY_HASH"
echo "🔗 Explorer: https://testnet.cspr.live/deploy/$DEPLOY_HASH"
echo ""
echo "⏳ Wait for finalization, then get the contract hash from the deploy details."
echo "   The contract key will be stored under name: rwa_raffle_cspr"
