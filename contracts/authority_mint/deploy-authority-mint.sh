#!/bin/bash
# Deploy Authority Mint Contract to Casper Testnet

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="../../Account 1_secret_key.pem"
PAYMENT_AMOUNT="200000000000"
WASM_PATH="./target/wasm32-unknown-unknown/release/authority_mint.wasm"

echo "🚀 Deploying Authority Mint Contract"
echo "   Node: $NODE_ADDRESS"
echo "   Chain: $CHAIN_NAME"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH"

echo ""
echo "✅ Deploy submitted! Check status with:"
echo "   casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
