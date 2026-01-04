#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
WASM_PATH="/Users/dellwatson/Desktop/casper/odra/examples/wasm/PublicCep95.wasm"
PAYMENT="500000000000"

echo "🚀 Deploying Public CEP-95 (anyone can mint)"

casper-client put-deploy \
  --node-address "$NODE_URL" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT" \
  --session-path "$WASM_PATH" \
  --session-arg "odra_cfg_package_hash_key_name:string='public_cep95_package_hash'" \
  --session-arg "odra_cfg_allow_key_override:bool='true'" \
  --session-arg "odra_cfg_is_upgradable:bool='true'" \
  --session-arg "odra_cfg_is_upgrade:bool='false'" \
  --session-arg "name:string='TixiaPublicCEP95'" \
  --session-arg "symbol:string='TIXPUB'"
