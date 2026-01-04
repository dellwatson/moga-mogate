#!/bin/bash
# Deploy Odra AntMintTest contract

set -e

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="200000000000"  # 200 CSPR
WASM_PATH="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/contracts/+odra_another_mint/AntMintTest.wasm"

INITIAL_VALUE="${1:-42}"

echo "🚀 Deploying Odra AntMintTest Contract"
echo "   Initial value: $INITIAL_VALUE"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "odra_cfg_package_hash_key_name:string='ant_mint_test_package_hash'" \
  --session-arg "odra_cfg_allow_key_override:bool='true'" \
  --session-arg "odra_cfg_is_upgradable:bool='true'"

echo ""
echo "✅ Deploy submitted!"
echo ""
echo "After deployment, the contract will have these entrypoints:"
echo "  - init(value: u64)"
echo "  - set_value(value: u64)"
echo "  - get_value() -> u64"
