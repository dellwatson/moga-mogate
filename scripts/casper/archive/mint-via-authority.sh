#!/bin/bash
# Mint NFT via Authority Mint Contract (Delegated Minting)

set -e

# Contract addresses
AUTHORITY_MINT_HASH="b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc"
TIXIA_1O1_COLLECTION_HASH="376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97"

# Network config
NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem"
PAYMENT_AMOUNT="5000000000"  # 5 CSPR

# Recipient (defaults to deployer account)
RECIPIENT_ACCOUNT_HASH="${1:-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8}"

# NFT Metadata
TOKEN_METADATA='{
  "name": "Tixia $100 Flight Credit",
  "token_uri": "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json"
}'

echo "🎫 Minting NFT via Authority Mint Contract"
echo "   Authority Mint: $AUTHORITY_MINT_HASH"
echo "   Collection: $TIXIA_1O1_COLLECTION_HASH"
echo "   Recipient: account-hash-$RECIPIENT_ACCOUNT_HASH"
echo "   Metadata: $TOKEN_METADATA"
echo ""

# Call authority mint contract's mint_nft entrypoint
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$AUTHORITY_MINT_HASH" \
  --session-entry-point "mint_nft" \
  --session-arg "collection_hash:byte_array_32='$TIXIA_1O1_COLLECTION_HASH'" \
  --session-arg "token_owner:key='account-hash-$RECIPIENT_ACCOUNT_HASH'" \
  --session-arg "token_metadata:string='$TOKEN_METADATA'"

echo ""
echo "✅ Mint deploy submitted!"
echo ""
echo "🔍 The authority mint contract will:"
echo "   1. Verify collection is allowed"
echo "   2. Increment mint counter"
echo "   3. Call CEP-78 collection's mint() entrypoint"
echo "   4. NFT will be minted to recipient"
echo ""
echo "Check status with:"
echo "   casper-client get-deploy --node-address $NODE_ADDRESS <DEPLOY_HASH>"
