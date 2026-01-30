#!/bin/bash
# Deploy Collection V2

set -e

# Load environment
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "🚀 Deploying mogate_nft_collection_rwa_v2.aleo..."
echo ""

cd programs/collection

# Use yes to auto-confirm
yes | leo deploy \
    --private-key "$PRIVATE_KEY" \
    --endpoint "https://api.provable.com/v2" \
    --network testnet \
    --broadcast || true

echo ""
echo "✅ Collection deployment complete!"
