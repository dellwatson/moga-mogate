#!/bin/bash
# Mint token on OwnedCep95 (CEP-95 NFT)

set -e

CONTRACT_HASH="d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe"
NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="5000000000"

# Recipient account hash (without "account-hash-" prefix)
RECIPIENT="${1:-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8}"
TOKEN_ID="${2:-1}"

echo "🎨 Minting CEP-95 NFT"
echo "   Contract: $CONTRACT_HASH"
echo "   Recipient: account-hash-$RECIPIENT"
echo "   Token ID: $TOKEN_ID"
echo ""

# CEP-95 mint signature: mint(to: Key, token_id: U256, metadata: List<(String, String)>)
# We'll pass minimal metadata as a list of tuples
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "hash-$CONTRACT_HASH" \
  --session-entry-point "mint" \
  --session-arg "to:key='account-hash-$RECIPIENT'" \
  --session-arg "token_id:u256='$TOKEN_ID'" \
  --session-arg "metadata:list='[[\"name\",\"Tixia Flight Credit\"],[\"symbol\",\"TIX95\"],[\"token_uri\",\"https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json\"]]'"

echo ""
echo "✅ Mint submitted!"
