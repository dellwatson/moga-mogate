#!/bin/bash
# Deploy ONLY gateway (skip collection dependency)

set -e

echo "🚀 Deploying mogate_authority_mint_gateway.aleo ONLY..."
echo ""

# Load environment
if [ -f .env ]; then
    source .env
elif [ -f ../../.env ]; then
    source ../../.env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check private key
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

echo "📝 Using endpoint: https://api.provable.com/v2"
echo ""

# Build first
echo "🔨 Building gateway..."
leo build

echo ""
echo "📦 Deploying gateway using snarkOS (skips collection)..."
echo ""

# Use snarkOS to deploy ONLY the gateway program
snarkos developer deploy \
  mogate_authority_mint_gateway.aleo \
  --private-key "$PRIVATE_KEY" \
  --query "https://api.provable.com/v2" \
  --path ./build/ \
  --broadcast "https://api.provable.com/v2/testnet/transaction/broadcast" \
  --priority-fee 0

echo ""
echo "✅ Gateway deployment complete!"
