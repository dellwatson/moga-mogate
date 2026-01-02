#!/bin/bash
# Deploy Tixia 1/1 Collection (CEP-78) to Casper Testnet

COLLECTION_NAME="Tixia Credits 1/1"
COLLECTION_SYMBOL="TIX1O1"
TOTAL_TOKEN_SUPPLY="1000"
COLLECTION_URI="https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/collections/casper/tixia/1o1/collection.json"

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="700000000000"
WASM_PATH="./cep78.wasm"

echo "🚀 Deploying CEP-78 Collection: $COLLECTION_NAME"
echo "   Symbol: $COLLECTION_SYMBOL"
echo "   Total Supply: $TOTAL_TOKEN_SUPPLY"
echo "   Collection URI: $COLLECTION_URI"
echo ""

casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$WASM_PATH" \
  --session-arg "collection_name:string='$COLLECTION_NAME'" \
  --session-arg "collection_symbol:string='$COLLECTION_SYMBOL'" \
  --session-arg "total_token_supply:u64='$TOTAL_TOKEN_SUPPLY'" \
  --session-arg "ownership_mode:u8='2'" \
  --session-arg "nft_kind:u8='1'" \
  --session-arg "nft_metadata_kind:u8='0'" \
  --session-arg "identifier_mode:u8='0'" \
  --session-arg "metadata_mutability:u8='0'" \
  --session-arg "minting_mode:u8='1'" \
  --session-arg "allow_minting:bool='true'" \
  --session-arg "holder_mode:u8='2'" \
  --session-arg "whitelist_mode:u8='0'" \
  --session-arg "burn_mode:u8='0'" \
  --session-arg "owner_reverse_lookup_mode:u8='1'" \
  --session-arg "events_mode:u8='1'"

echo ""
echo "✅ Deploy submitted! Check status with:"
echo "   casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
