#!/bin/bash

NODE_URL="http://65.109.83.79:7777"
FRESH_DEPLOY="6b1660a1df361ca2ef7a9ce378507c3f138bd008113823df35133b40b9a54a2c"
AUTHORITY_HASH="hash-011b472d6ba72303df22357de62f347b6f4dd0aac4d2804fa3e1604e00a4065a"

echo "🔍 Checking Fresh PUBLIC CEP-95 Deployment"
echo "=========================================="
echo ""
echo "Deploy: $FRESH_DEPLOY"
echo "Explorer: https://testnet.cspr.live/deploy/$FRESH_DEPLOY"
echo ""

STATUS=$(curl -s -X POST $NODE_URL/rpc \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$FRESH_DEPLOY\"},\"id\":1}" \
  | jq -r '.result.execution_results[0].result | if . then (if .Success then "✅ SUCCESS" else "❌ FAILED: " + (.Failure.error_message // "unknown") end) else "⏳ PENDING" end')

echo "Status: $STATUS"
echo ""

if [[ "$STATUS" == *"SUCCESS"* ]]; then
  echo "🎉 PUBLIC CEP-95 DEPLOYED!"
  echo ""
  echo "Extracting contract hash..."
  
  PUBLIC_CEP95_HASH=$(curl -s -X POST $NODE_URL/rpc \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$FRESH_DEPLOY\"},\"id\":1}" \
    | jq -r '
      .result.execution_results[0].result.Success.effect.transforms[] |
      select(.transform.WriteContract != null) |
      .key | 
      sub("contract-"; "hash-")
    ' | head -1)
  
  if [ -z "$PUBLIC_CEP95_HASH" ]; then
    PUBLIC_CEP95_HASH=$(curl -s -X POST $NODE_URL/rpc \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$FRESH_DEPLOY\"},\"id\":1}" \
      | jq -r '
        .result.execution_results[0].result.Success.effect.transforms[] |
        select(.transform.WriteCLValue != null) |
        select(.transform.WriteCLValue.parsed | startswith("contract-")) |
        .transform.WriteCLValue.parsed |
        sub("contract-"; "hash-")
      ' | head -1)
  fi
  
  echo "PUBLIC CEP-95: $PUBLIC_CEP95_HASH"
  echo "Authority Mint: $AUTHORITY_HASH (already deployed)"
  echo ""
  
  # Save contract hashes
  cat > deployment-casper/READY-TO-MINT.json <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "publicCep95": {
    "deployHash": "$FRESH_DEPLOY",
    "contractHash": "$PUBLIC_CEP95_HASH",
    "status": "SUCCESS",
    "explorerLink": "https://testnet.cspr.live/deploy/$FRESH_DEPLOY"
  },
  "authorityMint": {
    "deployHash": "bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965",
    "contractHash": "$AUTHORITY_HASH",
    "status": "SUCCESS",
    "explorerLink": "https://testnet.cspr.live/deploy/bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"
  },
  "readyToMint": true
}
EOF
  
  echo "📁 Saved to deployment-casper/READY-TO-MINT.json"
  echo ""
  
  # Update mint scripts
  sed -i.bak "s/const PUBLIC_CEP95_HASH = \"[^\"]*\"/const PUBLIC_CEP95_HASH = \"$PUBLIC_CEP95_HASH\"/" \
    scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js
  sed -i.bak "s/const NEW_AUTHORITY_MINT_HASH = \"[^\"]*\"/const NEW_AUTHORITY_MINT_HASH = \"$AUTHORITY_HASH\"/" \
    scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
  sed -i.bak "s/const PUBLIC_CEP95_HASH = \"[^\"]*\"/const PUBLIC_CEP95_HASH = \"$PUBLIC_CEP95_HASH\"/" \
    scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
  
  echo "✅ Updated mint scripts"
  echo ""
  echo "=========================================="
  echo "🎯 READY TO MINT!"
  echo "=========================================="
  echo ""
  echo "1. Direct mint on PUBLIC CEP-95:"
  echo "   node scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js"
  echo ""
  echo "2. Delegate mint (Authority Mint → PUBLIC CEP-95):"
  echo "   node scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js"
  echo ""
else
  echo "⏳ Still deploying... check again in 1-2 minutes"
  echo "   ./scripts/casper/check-fresh-deploy.sh"
fi
