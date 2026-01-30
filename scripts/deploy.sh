#!/bin/bash
# Quick deployment script for Aleo programs using Docker

set -e

echo "🐳 Aleo Docker Deployment Helper"
echo "================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env with PRIVATE_KEY=APrivateKey1zkp..."
    exit 1
fi

# Check if PRIVATE_KEY is set
source .env
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

echo "✅ Environment configured"
echo ""

# Show menu
echo "Select deployment option:"
echo "  1) Deploy collection only (mogate_nft_collection_rwa.aleo)"
echo "  2) Deploy gateway only (mogate_authority_mint_gateway.aleo)"
echo "  3) Deploy all programs (recommended)"
echo "  4) Interactive shell"
echo "  5) Exit"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying collection program..."
        docker-compose run --rm deploy-collection
        ;;
    2)
        echo ""
        echo "🚀 Deploying gateway program..."
        echo "⚠️  Make sure collection is deployed first!"
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" = "y" ]; then
            docker-compose run --rm deploy-gateway
        fi
        ;;
    3)
        echo ""
        echo "🚀 Deploying all programs..."
        docker-compose run --rm deploy-all
        ;;
    4)
        echo ""
        echo "🔧 Starting interactive shell..."
        docker-compose run --rm aleo-dev
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"
