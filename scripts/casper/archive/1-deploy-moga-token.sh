#!/bin/bash
# Deploy MOGA CEP-18 Token to Casper Testnet

set -e

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="../../Account 1_secret_key.pem"
PAYMENT_AMOUNT="200000000000"  # 200 CSPR

# MOGA Token Config
TOKEN_NAME="MOGA Token"
TOKEN_SYMBOL="MOGA"
DECIMALS="9"
TOTAL_SUPPLY="1000000000000000000"  # 1 billion with 9 decimals

# Download CEP-18 WASM if not exists
WASM_PATH="/tmp/cep18.wasm"
if [ ! -f "$WASM_PATH" ]; then
    echo "📥 Downloading CEP-18 WASM..."
    curl -L -o "$WASM_PATH" https://github.com/casper-ecosystem/cep18/releases/download/v1.1.2/cep18.wasm
    echo "✅ Downloaded"
    echo ""
fi

echo "🪙 Deploying MOGA CEP-18 Token"
echo "   Name: $TOKEN_NAME"
echo "   Symbol: $TOKEN_SYMBOL"
echo "   Decimals: $DECIMALS"
echo "   Total Supply: $TOTAL_SUPPLY"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "name:string='$TOKEN_NAME'" \
  --session-arg "symbol:string='$TOKEN_SYMBOL'" \
  --session-arg "decimals:u8='$DECIMALS'" \
  --session-arg "total_supply:u256='$TOTAL_SUPPLY'"

echo ""
echo "✅ Deploy submitted! Check status with:"
echo "   casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
echo ""
echo "💾 Save the contract hash to .deployed-moga-token-testnet.json"
