#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
PUBLIC_CEP95_DEPLOY="fa2e3339848f555f6d6261b3c53eebd2bfea3074ca38bd491eda882b3397be88"

echo "🔍 Checking Public CEP-95 deployment status..."
echo ""

# Get deploy status
RESULT=$(casper-client get-deploy --node-address "$NODE_URL" "$PUBLIC_CEP95_DEPLOY" 2>&1)

# Check if successful
if echo "$RESULT" | grep -q '"Success"'; then
    echo "✅ Public CEP-95 deployed successfully!"
    echo ""
    
    # Extract contract hash
    CONTRACT_HASH=$(echo "$RESULT" | jq -r '.result.execution_results[0].result.Success.effect.transforms[] | select(.key | startswith("hash-")) | select(.transform == "Identity") | .key' | head -1)
    
    if [ -z "$CONTRACT_HASH" ]; then
        echo "⚠️  Could not extract contract hash. Checking named keys..."
        CONTRACT_HASH=$(echo "$RESULT" | jq -r '.result.execution_results[0].result.Success.effect.transforms[] | select(.key | contains("public_cep95")) | .transform.WriteCLValue.parsed' | grep "hash-" | head -1 | tr -d '"')
    fi
    
    if [ -n "$CONTRACT_HASH" ]; then
        echo "📝 Public CEP-95 Contract Hash: $CONTRACT_HASH"
        echo ""
        
        # Save to file
        echo "$CONTRACT_HASH" > /tmp/public_cep95_hash.txt
        
        echo "🔐 Step 1: Whitelisting collection in Authority Mint..."
        node scripts/casper/whitelist-authority-mint.js "$CONTRACT_HASH"
        
        echo ""
        echo "⏳ Waiting 30 seconds for whitelist to process..."
        sleep 30
        
        echo ""
        echo "🎯 Step 2: Delegate minting via Authority Mint..."
        
        # Update the script with the contract hash
        sed -i.bak "s/const PUBLIC_CEP95_HASH = \"PENDING\"/const PUBLIC_CEP95_HASH = \"$CONTRACT_HASH\"/" scripts/casper/delegate-mint-public-cep95.js
        
        node scripts/casper/delegate-mint-public-cep95.js
        
    else
        echo "❌ Could not find contract hash in deploy result"
        echo "   Please check manually and run:"
        echo "   node scripts/casper/whitelist-authority-mint.js <hash>"
        echo "   node scripts/casper/delegate-mint-public-cep95.js"
    fi
    
elif echo "$RESULT" | grep -q '"Failure"'; then
    echo "❌ Public CEP-95 deployment FAILED!"
    echo "$RESULT" | jq '.result.execution_results[0].result.Failure'
else
    echo "⏳ Public CEP-95 deployment still PENDING"
    echo "   Run this script again in 30-60 seconds"
    echo ""
    echo "   Or check manually:"
    echo "   casper-client get-deploy --node-address $NODE_URL $PUBLIC_CEP95_DEPLOY"
fi
