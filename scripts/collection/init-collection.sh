#!/bin/bash
# Initialize Collection and Set Minter
# Run this after deploying mogate_nft_collection_rwa.aleo

set -e

# Load environment
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Configuration
OWNER_ADDRESS="aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2"
GATEWAY_PROGRAM="mogate_authority_mint_v2.aleo"
ENDPOINT="https://api.provable.com/v2"
NETWORK="testnet"

echo "🚀 Initializing Collection and Setting Minter..."
echo ""
echo "Owner Address: $OWNER_ADDRESS"
echo "Gateway Program: $GATEWAY_PROGRAM"
echo ""

cd programs/collection

# Step 1: Initialize the collection
echo "📝 Step 1: Initializing collection..."
leo execute initialize "$OWNER_ADDRESS" \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ Collection initialized!"
echo ""

# Wait a bit for the transaction to be confirmed
echo "⏳ Waiting 5 seconds for confirmation..."
sleep 5
echo ""

# Step 2: Set gateway as minter
echo "📝 Step 2: Setting gateway as minter..."
leo execute set_minter "$GATEWAY_PROGRAM" true \
    --network "$NETWORK" \
    --endpoint "$ENDPOINT" \
    --broadcast

echo ""
echo "✅ Gateway set as minter!"
echo ""
echo "🎉 Collection setup complete!"
echo ""
echo "Summary:"
echo "  - Collection Owner: $OWNER_ADDRESS"
echo "  - Authorized Minter: $GATEWAY_PROGRAM"
echo "  - Network: $NETWORK"
