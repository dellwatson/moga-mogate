#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
AUTHORITY_UPGRADE_HASH="5ee02b833477549d9c54d0c58be3c637b153e85c63267aa86f1e3944a073ec56"
PUBLIC_CEP95_DEPLOY_HASH="fa2e3339848f555f6d6261b3c53eebd2bfea3074ca38bd491eda882b3397be88"

echo "📊 DEPLOYMENT STATUS CHECK"
echo "=========================================="
echo ""

# Check Authority Mint upgrade
echo "🔄 Authority Mint Upgrade:"
AUTHORITY_STATUS=$(casper-client get-deploy --node-address "$NODE_URL" "$AUTHORITY_UPGRADE_HASH" 2>&1 | jq -r '.result.execution_results[0].result | if . == null then "PENDING" elif .Success then "SUCCESS" else "FAILED" end' 2>/dev/null || echo "PENDING")
echo "   Status: $AUTHORITY_STATUS"
echo "   Hash: $AUTHORITY_UPGRADE_HASH"
echo ""

# Check Public CEP-95 deployment
echo "🎨 Public CEP-95 Deployment:"
PUBLIC_STATUS=$(casper-client get-deploy --node-address "$NODE_URL" "$PUBLIC_CEP95_DEPLOY_HASH" 2>&1 | jq -r '.result.execution_results[0].result | if . == null then "PENDING" elif .Success then "SUCCESS" else "FAILED" end' 2>/dev/null || echo "PENDING")
echo "   Status: $PUBLIC_STATUS"
echo "   Hash: $PUBLIC_CEP95_DEPLOY_HASH"

if [ "$PUBLIC_STATUS" = "SUCCESS" ]; then
    # Extract contract hash
    PUBLIC_HASH=$(casper-client get-deploy --node-address "$NODE_URL" "$PUBLIC_CEP95_DEPLOY_HASH" 2>&1 | jq -r '.result.execution_results[0].result.Success.effect.transforms[] | select(.key | startswith("hash-")) | select(.transform == "Identity") | .key' | head -1)
    
    if [ -n "$PUBLIC_HASH" ]; then
        echo "   Contract: $PUBLIC_HASH"
        echo ""
        echo "✅ Ready to mint!"
        echo ""
        
        # Update mint script
        sed -i.bak "s/const PUBLIC_CEP95_HASH = \"PENDING\"/const PUBLIC_CEP95_HASH = \"$PUBLIC_HASH\"/" scripts/casper/mint-public-cep95-direct.js
        
        echo "🚀 Minting on Public CEP-95..."
        node scripts/casper/mint-public-cep95-direct.js
    fi
else
    echo ""
    echo "⏳ Waiting for deployments to finalize..."
    echo "   Run this script again in 30-60 seconds"
fi
