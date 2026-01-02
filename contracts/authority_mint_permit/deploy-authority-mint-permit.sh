#!/bin/bash
# Deploy Authority Mint Permit Contract to Casper Testnet

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="../../Account 1_secret_key.pem"
PAYMENT_AMOUNT="250000000000"  # 250 CSPR
WASM_PATH="./target/wasm32-unknown-unknown/release/authority_mint_permit.wasm"

# Authority public key (the backend's key that will sign permits)
# Replace with your actual authority public key
AUTHORITY_PUBLIC_KEY="020363fc89757f974d8d08d8f61ffe805108e2bfc938234d841fd8101e4a08d6e257"

echo "🚀 Deploying Authority Mint Permit Contract"
echo "   Node: $NODE_ADDRESS"
echo "   Chain: $CHAIN_NAME"
echo "   Authority Key: $AUTHORITY_PUBLIC_KEY"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "authority_public_key:public_key='$AUTHORITY_PUBLIC_KEY'"

echo ""
echo "✅ Deploy submitted! Check status with:"
echo "   casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
