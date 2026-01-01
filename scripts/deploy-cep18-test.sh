#!/bin/bash

# Deploy a CEP-18 token to Casper testnet
# This is a test deployment to verify your setup works

set -e

PEM_FILE="Account 1_secret_key.pem"
NODE_ADDRESS="https://rpc.testnet.casperlabs.io"
CHAIN_NAME="casper-test"

echo "🚀 Deploying CEP-18 test token to Casper testnet..."
echo ""

# Check if we have the WASM file
if [ ! -f "/tmp/cep18.wasm" ]; then
    echo "📥 Downloading CEP-18 WASM..."
    curl -L -o /tmp/cep18.wasm https://github.com/casper-ecosystem/cep18/releases/download/v1.1.2/cep18.wasm
    echo "✅ Downloaded"
    echo ""
fi

echo "📝 Deploy parameters:"
echo "  Token Name: MOGA Test Token"
echo "  Symbol: MOGA"
echo "  Decimals: 9"
echo "  Total Supply: 1,000,000,000"
echo ""

# Deploy
echo "🔨 Deploying contract..."
DEPLOY_OUTPUT=$(casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$PEM_FILE" \
  --payment-amount 200000000000 \
  --session-path /tmp/cep18.wasm \
  --session-arg "name:string='MOGA Test Token'" \
  --session-arg "symbol:string='MOGA'" \
  --session-arg "decimals:u8='9'" \
  --session-arg "total_supply:u256='1000000000000000000'" 2>&1)

echo "$DEPLOY_OUTPUT"
echo ""

# Extract deploy hash
DEPLOY_HASH=$(echo "$DEPLOY_OUTPUT" | grep -o 'deploy-[a-f0-9]*' | head -1)

if [ -z "$DEPLOY_HASH" ]; then
    echo "❌ Failed to get deploy hash"
    exit 1
fi

echo "✅ Deploy submitted!"
echo "Deploy Hash: $DEPLOY_HASH"
echo ""
echo "🔍 Check status with:"
echo "casper-client get-deploy --node-address $NODE_ADDRESS $DEPLOY_HASH"
echo ""
echo "⏳ Waiting 30 seconds for deploy to finalize..."
sleep 30

echo ""
echo "📊 Checking deploy status..."
casper-client get-deploy --node-address "$NODE_ADDRESS" "$DEPLOY_HASH"
