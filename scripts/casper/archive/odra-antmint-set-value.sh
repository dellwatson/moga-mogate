#!/bin/bash
# Call Odra AntMintTest.set_value on existing deployed contract

set -e

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="20000000000" # 20 CSPR

# From deployment-casper/.deployed-odra-ant-mint-testnet.json
CONTRACT_HASH_HEX="15aea07a2f0db5ea30f33b8611be7c0618e04edfb13426cd65485e3868ee682a"
SESSION_HASH="hash-$CONTRACT_HASH_HEX"

NEW_VALUE="${1:-1234}"

echo "🚀 Calling AntMintTest.set_value on existing contract"
echo "   Contract hash: $SESSION_HASH"
echo "   New value: $NEW_VALUE"

echo ""
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$SESSION_HASH" \
  --session-entry-point "set_value" \
  --session-arg "value:u64='$NEW_VALUE'"

echo ""
echo "✅ set_value deploy submitted"
