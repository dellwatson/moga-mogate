#!/bin/bash
# Mint CEP-95 token using session WASM caller

set -e

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="5000000000"

# CEP-95 contract
CONTRACT_HASH="hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe"

# Recipient (our account)
RECIPIENT_ACCOUNT_HASH="${1:-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8}"

# Token ID
TOKEN_ID="${2:-1}"

WASM_PATH="contracts/cep95_mint_caller/target/wasm32-unknown-unknown/release/cep95_mint_caller.wasm"

echo "🎨 Minting CEP-95 token via session WASM"
echo "   Contract: $CONTRACT_HASH"
echo "   Recipient: account-hash-$RECIPIENT_ACCOUNT_HASH"
echo "   Token ID: $TOKEN_ID"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "contract_hash:key='$CONTRACT_HASH'" \
  --session-arg "token_id:u256='$TOKEN_ID'"

echo ""
echo "✅ Deploy submitted! Check the deploy hash above."
