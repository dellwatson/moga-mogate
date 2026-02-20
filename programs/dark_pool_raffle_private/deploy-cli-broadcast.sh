#!/bin/bash
# Deploy template using Leo CLI

set -e

echo "🚀 Deploying aleo program using Leo CLI..."
echo ""

# Check if .env exists
if [ -f .env ]; then
    source .env
elif [ -f ../../.env ]; then
    source ../../.env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Source .env
export $(cat .env | grep -v '^#' | xargs)

# Check private key
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

echo "📝 Using endpoint: ${ALEO_ENDPOINT:-https://api.provable.com/v2/testnet}"
echo "💰 Using fee: ${ALEO_DEPLOY_FEE:-3.8}"
echo ""

# Deploy using Leo CLI
# Try without /testnet in endpoint
# Add --broadcast to actually send to network (not just estimate)
leo deploy \
    --private-key "$PRIVATE_KEY" \
    --endpoint "https://api.provable.com/v2" \
    --network testnet \
    --broadcast


echo ""
echo "✅ Deployment command executed"
