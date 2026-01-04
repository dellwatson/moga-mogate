#!/bin/bash
# Deploy Odra OwnedCep95 (CEP-95 NFT contract)

set -e

WASM_PATH="/Users/dellwatson/Desktop/casper/odra/examples/wasm/OwnedCep95.wasm"
NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="500000000000"

NAME="TixiaOwnedCEP95"
SYMBOL="TIX95"

echo "🚀 Deploying Odra OwnedCep95 NFT Contract"
echo "   Name: $NAME"
echo "   Symbol: $SYMBOL"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "odra_cfg_package_hash_key_name:string='owned_cep95_package_hash'" \
  --session-arg "odra_cfg_allow_key_override:bool='true'" \
  --session-arg "odra_cfg_is_upgradable:bool='true'" \
  --session-arg "odra_cfg_is_upgrade:bool='false'" \
  --session-arg "name:string='$NAME'" \
  --session-arg "symbol:string='$SYMBOL'"

echo ""
echo "✅ Deploy submitted!"
