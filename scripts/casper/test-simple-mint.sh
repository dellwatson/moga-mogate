#!/bin/bash
# Simplest possible mint test

set -e

COLLECTION_HASH="cd58d50c38e7dbce3bebab7f970d48dc8b6dfd9e14155e237635fec3bd1e91f6"
NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="5000000000"

RECIPIENT_ACCOUNT_HASH="1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8"

# Simplest metadata - just a URL string
TOKEN_METADATA="ipfs://QmTest123"

echo "🎫 Testing SIMPLEST mint"
echo "   Collection: $COLLECTION_HASH"
echo "   Recipient: account-hash-$RECIPIENT_ACCOUNT_HASH"
echo "   Metadata: $TOKEN_METADATA"
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
echo "✅ Mint submitted!"
