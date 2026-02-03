#!/bin/bash
# Query NFT Information
# Get owner and URI for a specific token ID

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
    echo "Usage: ./query-nft.sh <TOKEN_ID>"
    echo ""
    echo "Example:"
    echo "  ./query-nft.sh 1"
    exit 1
fi

TOKEN_ID="$1"

echo "🔍 Querying NFT Information..."
echo ""
echo "Token ID: $TOKEN_ID"
echo ""

cd programs/collection

# Query token owner
echo "📝 Getting token owner..."
leo execute get_token_owner "${TOKEN_ID}u64" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "---"
echo ""

# Query token URI
echo "📝 Getting token URI..."
leo execute get_token_uri "${TOKEN_ID}u64" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ Query complete!"
