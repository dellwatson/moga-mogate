#!/bin/bash
# Burn NFT from Collection
# This script burns an NFT by removing it from the collection

set -e

# Load environment
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Configuration
ENDPOINT="https://api.provable.com/v2"
NETWORK="testnet"

# Check if token_id is provided
if [ -z "$1" ]; then
    echo "❌ Error: Token ID required"
    echo ""
    echo "Usage: ./burn-nft.sh <TOKEN_ID> <OWNER_ADDRESS> <URI_HASH> <COLLECTION_ADDRESS>"
    echo ""
    echo "Example:"
    echo "  ./burn-nft.sh 1 aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2 123456field mogate_nft_collection_rwa.aleo"
    echo ""
    echo "Note: You need the NFT record to burn it (owner, token_id, uri, collection)"
    exit 1
fi

TOKEN_ID="$1"
OWNER="${2:-aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2}"
URI_HASH="${3:-0field}"
COLLECTION="${4:-mogate_nft_collection_rwa.aleo}"

echo "🔥 Burning NFT..."
echo ""
echo "Token ID: $TOKEN_ID"
echo "Owner: $OWNER"
echo "URI Hash: $URI_HASH"
echo "Collection: $COLLECTION"
echo ""

cd programs/collection

# Burn the NFT
# Note: In Aleo, you need to pass the NFT record to burn it
# The record format is: {owner: address, token_id: u64, uri: field, collection: address}
echo "📝 Executing burn transaction..."
echo ""
echo "⚠️  WARNING: This will permanently delete the NFT from the collection!"
echo ""

# Create the NFT record string
NFT_RECORD="{owner: ${OWNER}, token_id: ${TOKEN_ID}u64, uri: ${URI_HASH}, collection: ${COLLECTION}}"

leo execute burn "$NFT_RECORD" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ NFT burned successfully!"
echo ""
echo "Summary:"
echo "  - Token ID: $TOKEN_ID"
echo "  - Removed from collection: $COLLECTION"
echo "  - Network: $NETWORK"
