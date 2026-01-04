#!/bin/bash
# Call Odra AntMintTest.get_value on existing deployed contract

set -e

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="20000000000" # 20 CSPR

CONTRACT_HASH_HEX="15aea07a2f0db5ea30f33b8611be7c0618e04edfb13426cd65485e3868ee682a"
SESSION_HASH="hash-$CONTRACT_HASH_HEX"

echo "📥 Calling AntMintTest.get_value on existing contract"
echo "   Contract hash: $SESSION_HASH"

echo ""
DEPLOY_JSON=$(casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$SESSION_HASH" \
  --session-entry-point "get_value")

DEPLOY_HASH=$(echo "$DEPLOY_JSON" | grep -o '"deploy_hash": "[a-f0-9]*"' | head -1 | sed 's/"deploy_hash": "//; s/"//')

echo "Deploy hash: $DEPLOY_HASH"
echo "Waiting for execution..."
sleep 15

echo "Result (grep around "parsed"):" 
casper-client get-deploy --node-address "$NODE_ADDRESS" "$DEPLOY_HASH" 2>&1 | grep -A 5 '"parsed"' | head -10
