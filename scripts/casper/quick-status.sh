#!/bin/bash

NODE_URL="http://65.109.83.79:7777"

echo "🔍 Quick Status Check"
echo "===================="
echo ""

# Check PUBLIC CEP-95
echo "📦 PUBLIC CEP-95"
STATUS1=$(curl -s -X POST $NODE_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"info_get_deploy","params":{"deploy_hash":"f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"},"id":1}' \
  | jq -r '.result.execution_results[0].result | if . then (if .Success then "✅ SUCCESS" else "❌ FAILED: " + (.Failure.error_message // "unknown") end) else "⏳ PENDING" end')
echo "   $STATUS1"
echo "   https://testnet.cspr.live/deploy/f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"
echo ""

# Check Authority Mint
echo "📦 Authority Mint"
STATUS2=$(curl -s -X POST $NODE_URL/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"info_get_deploy","params":{"deploy_hash":"bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"},"id":1}' \
  | jq -r '.result.execution_results[0].result | if . then (if .Success then "✅ SUCCESS" else "❌ FAILED: " + (.Failure.error_message // "unknown") end) else "⏳ PENDING" end')
echo "   $STATUS2"
echo "   https://testnet.cspr.live/deploy/bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"
echo ""

if [[ "$STATUS1" == *"SUCCESS"* ]] && [[ "$STATUS2" == *"SUCCESS"* ]]; then
  echo "✅ Both contracts deployed! Run:"
  echo "   ./scripts/casper/extract-contract-hashes.sh"
elif [[ "$STATUS1" == *"PENDING"* ]] || [[ "$STATUS2" == *"PENDING"* ]]; then
  echo "⏳ Still deploying... check again in 1-2 minutes"
else
  echo "⚠️  Check explorer links above for details"
fi
