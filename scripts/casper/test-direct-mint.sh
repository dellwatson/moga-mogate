#!/bin/bash
# Test direct mint to CEP-78 collection (bypass authority mint)

set -e

COLLECTION_HASH="37ef05f3d9138c89c015bf0ce955391ed429e0668722ca62d2e6155d2b8696a2"
NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="5000000000"

RECIPIENT_ACCOUNT_HASH="${1:-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8}"

TOKEN_METADATA="Just a simple string - Raw metadata accepts anything"

echo "🎫 Testing DIRECT mint to CEP-78 collection"
echo "   Collection: $COLLECTION_HASH"
echo "   Recipient: account-hash-$RECIPIENT_ACCOUNT_HASH"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$COLLECTION_HASH" \
  --session-entry-point "mint" \
  --session-arg "token_owner:key='account-hash-$RECIPIENT_ACCOUNT_HASH'" \
  --session-arg "token_meta_data:string='$TOKEN_METADATA'"

echo ""
echo "✅ Direct mint submitted!"
