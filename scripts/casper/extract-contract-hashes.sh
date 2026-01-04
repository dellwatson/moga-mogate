#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
ACCOUNT_HASH="account-hash-8e8a0c3b0f0c7a8e8b8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e"
PUBLIC_KEY="020214d6c4f5f7e8b8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e"

echo "🔍 Extracting contract hashes from deploys..."
echo ""

# Check PUBLIC CEP-95
echo "📦 PUBLIC CEP-95"
echo "Deploy: f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"
PUBLIC_CEP95_HASH=$(curl -s -X POST $NODE_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"info_get_deploy",
    "params":{"deploy_hash":"f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"},
    "id":1
  }' | jq -r '
    .result.execution_results[0].result.Success.effect.transforms[] |
    select(.transform.WriteContract != null) |
    .key | 
    sub("contract-"; "hash-")
  ' | head -1)

if [ -z "$PUBLIC_CEP95_HASH" ]; then
  echo "⏳ Status: PENDING or checking alternative method..."
  PUBLIC_CEP95_HASH=$(curl -s -X POST $NODE_URL/rpc \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc":"2.0",
      "method":"info_get_deploy",
      "params":{"deploy_hash":"f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"},
      "id":1
    }' | jq -r '
      .result.execution_results[0].result.Success.effect.transforms[] |
      select(.transform.WriteCLValue != null) |
      select(.transform.WriteCLValue.parsed | startswith("contract-")) |
      .transform.WriteCLValue.parsed |
      sub("contract-"; "hash-")
    ' | head -1)
fi

if [ -n "$PUBLIC_CEP95_HASH" ]; then
  echo "✅ Contract Hash: $PUBLIC_CEP95_HASH"
else
  echo "⏳ Still pending..."
fi
echo ""

# Check Authority Mint
echo "📦 Authority Mint"
echo "Deploy: bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"
AUTHORITY_MINT_HASH=$(curl -s -X POST $NODE_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"info_get_deploy",
    "params":{"deploy_hash":"bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"},
    "id":1
  }' | jq -r '
    .result.execution_results[0].result.Success.effect.transforms[] |
    select(.transform.WriteContract != null) |
    .key | 
    sub("contract-"; "hash-")
  ' | head -1)

if [ -z "$AUTHORITY_MINT_HASH" ]; then
  echo "⏳ Status: PENDING or checking alternative method..."
  AUTHORITY_MINT_HASH=$(curl -s -X POST $NODE_URL/rpc \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc":"2.0",
      "method":"info_get_deploy",
      "params":{"deploy_hash":"bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"},
      "id":1
    }' | jq -r '
      .result.execution_results[0].result.Success.effect.transforms[] |
      select(.transform.WriteCLValue != null) |
      select(.transform.WriteCLValue.parsed | startswith("contract-")) |
      .transform.WriteCLValue.parsed |
      sub("contract-"; "hash-")
    ' | head -1)
fi

if [ -n "$AUTHORITY_MINT_HASH" ]; then
  echo "✅ Contract Hash: $AUTHORITY_MINT_HASH"
else
  echo "⏳ Still pending..."
fi
echo ""

# Save to JSON if both are ready
if [ -n "$PUBLIC_CEP95_HASH" ] && [ -n "$AUTHORITY_MINT_HASH" ]; then
  echo "============================================================"
  echo "✅ BOTH CONTRACTS DEPLOYED!"
  echo "============================================================"
  
  cat > deployment-casper/CONTRACT-HASHES.json <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "publicCep95": {
    "deployHash": "f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136",
    "contractHash": "$PUBLIC_CEP95_HASH",
    "status": "SUCCESS",
    "explorerLink": "https://testnet.cspr.live/deploy/f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"
  },
  "authorityMint": {
    "deployHash": "bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965",
    "contractHash": "$AUTHORITY_MINT_HASH",
    "status": "SUCCESS",
    "explorerLink": "https://testnet.cspr.live/deploy/bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"
  }
}
EOF
  
  echo ""
  echo "📁 Saved to deployment-casper/CONTRACT-HASHES.json"
  echo ""
  echo "🔄 Updating mint scripts..."
  
  # Update direct mint script
  sed -i.bak "s/const PUBLIC_CEP95_HASH = \"[^\"]*\"/const PUBLIC_CEP95_HASH = \"$PUBLIC_CEP95_HASH\"/" \
    scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js
  echo "✅ Updated FINAL-direct-mint-PUBLIC-cep95.js"
  
  # Update delegate mint script
  sed -i.bak "s/const NEW_AUTHORITY_MINT_HASH = \"[^\"]*\"/const NEW_AUTHORITY_MINT_HASH = \"$AUTHORITY_MINT_HASH\"/" \
    scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
  sed -i.bak "s/const PUBLIC_CEP95_HASH = \"[^\"]*\"/const PUBLIC_CEP95_HASH = \"$PUBLIC_CEP95_HASH\"/" \
    scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
  echo "✅ Updated FINAL-delegate-mint-PUBLIC-cep95.js"
  
  echo ""
  echo "============================================================"
  echo "🎯 READY TO MINT!"
  echo "============================================================"
  echo ""
  echo "Run these commands:"
  echo ""
  echo "1. Direct mint on PUBLIC CEP-95:"
  echo "   node scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js"
  echo ""
  echo "2. Delegate mint (Authority Mint → PUBLIC CEP-95):"
  echo "   node scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js"
  echo ""
else
  echo "⏳ Waiting for contracts to deploy..."
  echo "Run this script again in 1-2 minutes."
fi
