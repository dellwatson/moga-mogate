#!/bin/bash
# Burn private ARC-721 NFT and send receipt to a specified recipient

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

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "❌ Error: NFT record and receipt recipient required"
    echo ""
    echo "Usage:"
    echo "  ./scripts/arc721_private/burn-private-with-receipt-to.sh '<NFT_RECORD>' <RECEIPT_RECIPIENT>"
    echo ""
    echo "Example (format must be exact Leo record syntax):"
    echo "  ./scripts/arc721_private/burn-private-with-receipt-to.sh '{owner: aleo1..., data: {metadata: [0field,0field,0field,0field], name: [0field,0field,0field,0field], image: [0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field,0field], attributes: [{trait_type: [0field,0field,0field,0field], _value: [0field,0field,0field,0field]},{trait_type: [0field,0field,0field,0field], _value: [0field,0field,0field,0field]},{trait_type: [0field,0field,0field,0field], _value: [0field,0field,0field,0field]},{trait_type: [0field,0field,0field,0field], _value: [0field,0field,0field,0field]}]}, edition: 1scalar}' aleo1backend..."
    echo ""
    exit 1
fi

NFT_RECORD="$1"
RECEIPT_RECIPIENT="$2"

echo "🔥 Burning private ARC-721 NFT (receipt to recipient)..."
echo ""
echo "Receipt recipient: $RECEIPT_RECIPIENT"
echo "Network: $NETWORK"
echo "Endpoint: $ENDPOINT"
echo ""
echo "⚠️  WARNING: This will permanently delete the NFT!"
echo ""

cd "$PROGRAM_DIR"

leo execute burn_private_with_receipt_to "$NFT_RECORD" "$RECEIPT_RECIPIENT" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ Burn submitted (receipt sent to recipient)."
