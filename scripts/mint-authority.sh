#!/bin/bash
# Mint NFT through Authority Mint Gateway (Owner Only)

set -e

# Load environment variables
if [ -f ../.env ]; then
    source ../.env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check private key
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

# Parameters
TO_ADDRESS="${1:-$PRIVATE_KEY}"  # Default to self if not provided
URI_HASH="${2:-123456789field}"   # Default URI hash
TOKEN_ID="${3:-1u64}"             # Default token ID

echo "🎨 Minting NFT through Authority Gateway (Owner Only)"
echo "=================================================="
echo "To Address:  $TO_ADDRESS"
echo "URI Hash:    $URI_HASH"
echo "Token ID:    $TOKEN_ID"
echo ""

# Navigate to gateway directory
cd ../programs/authority_mint_gateway

# Execute mint transition
leo run mint \
    "$TO_ADDRESS" \
    "$URI_HASH" \
    "$TOKEN_ID" \
    --private-key "$PRIVATE_KEY" \
    --endpoint "https://api.provable.com/v2" \
    --network testnet

echo ""
echo "✅ Mint transaction created!"
echo ""
echo "To broadcast to network:"
echo "leo execute mint \"$TO_ADDRESS\" \"$URI_HASH\" \"$TOKEN_ID\" --private-key \"\$PRIVATE_KEY\" --endpoint \"https://api.provable.com/v2\" --network testnet --broadcast"
