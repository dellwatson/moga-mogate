#!/bin/bash
# Burn private ARC-721 NFT (record-based)

set -e

# Load environment
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Configuration
ENDPOINT="${ENDPOINT:-https://api.provable.com/v2}"
NETWORK="${NETWORK:-testnet}"
PROGRAM_DIR="programs/arc721_private_collection"

if [ -z "$1" ]; then
    echo "❌ Error: NFT record required"
    echo ""
    echo "Usage:"
    echo "  ./scripts/arc721_private/burn-private.sh '<NFT_RECORD>'"
    echo ""
    echo "Example (format must be exact Leo record syntax):"
    echo "  ./scripts/arc721_private/burn-private.sh '{owner: aleo1..., data: {metadata: [0field,0field,0field,0field]}, edition: 1scalar}'"
    echo ""
    echo "Note: Use the exact PrivateNFT record from your wallet output."
    exit 1
fi

NFT_RECORD="$1"

echo "🔥 Burning private ARC-721 NFT..."
echo ""
echo "Network: $NETWORK"
echo "Endpoint: $ENDPOINT"
echo ""
echo "⚠️  WARNING: This will permanently delete the NFT!"
echo ""

cd "$PROGRAM_DIR"

leo execute burn_private "$NFT_RECORD" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ Burn submitted."
