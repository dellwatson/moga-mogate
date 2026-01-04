#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
WASM_PATH="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/contracts/authority_mint/target/wasm32-unknown-unknown/release/authority_mint.wasm"
PACKAGE_HASH="contract-package-a24eaa7fb04639155832147ee177ca4088dc4b5658265d5bc203e02810e93475"
PAYMENT="200000000000"

echo "🔄 Upgrading Authority Mint - REMOVING WHITELIST CHECK"
echo ""
echo "Package Hash: $PACKAGE_HASH"
echo "WASM: $WASM_PATH"
echo ""

casper-client put-deploy \
  --node-address "$NODE_URL" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT" \
  --session-path "$WASM_PATH"

echo ""
echo "✅ Upgrade deploy submitted!"
echo "⏳ Wait 2-3 minutes for upgrade to finalize"
