#!/bin/bash

# Verify burn transaction from just the deploy hash
# Usage: ./verify-burn-simple.sh <burn-deploy-hash>

BURN_HASH=$1
NODE_URL="http://65.109.83.79:7777"
EXPECTED_COLLECTION="hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739"

if [ -z "$BURN_HASH" ]; then
  echo "❌ Usage: ./verify-burn-simple.sh <burn-deploy-hash>"
  exit 1
fi

echo "🔍 Verifying Burn Transaction"
echo ""
echo "Burn Deploy Hash: $BURN_HASH"
echo "Expected Collection: $EXPECTED_COLLECTION"
echo ""

# STEP 1: Check if burn was successful
echo "📋 STEP 1: Checking execution status..."
ERROR=$(curl -s -X POST $NODE_URL/rpc -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$BURN_HASH\"},\"id\":1}" \
  | jq -r '.result.execution_info.execution_result.Version2.error_message')

if [ "$ERROR" != "null" ]; then
  echo "   ❌ Burn FAILED: $ERROR"
  exit 1
fi
echo "   ✅ Burn transaction successful"
echo ""

# STEP 2: Extract contract hash
echo "📋 STEP 2: Extracting contract hash..."
CONTRACT_HASH=$(curl -s -X POST $NODE_URL/rpc -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$BURN_HASH\"},\"id\":1}" \
  | jq -r '.result.deploy.session.StoredContractByHash.hash')

CONTRACT_HASH="hash-$CONTRACT_HASH"
echo "   Contract: $CONTRACT_HASH"

# STEP 3: Verify collection
echo ""
echo "📋 STEP 3: Verifying collection..."
if [ "$CONTRACT_HASH" == "$EXPECTED_COLLECTION" ]; then
  echo "   ✅ CORRECT COLLECTION!"
else
  echo "   ❌ WRONG COLLECTION!"
  echo "   Expected: $EXPECTED_COLLECTION"
  echo "   Got: $CONTRACT_HASH"
  exit 1
fi

# STEP 4: Extract token ID
echo ""
echo "📋 STEP 4: Extracting token ID..."
TOKEN_ID=$(curl -s -X POST $NODE_URL/rpc -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$BURN_HASH\"},\"id\":1}" \
  | jq -r '.result.deploy.session.StoredContractByHash.args[] | select(.[0] == "token_id") | .[1].parsed')

echo "   ✅ Token ID: $TOKEN_ID"

# STEP 5: Extract burner
echo ""
echo "📋 STEP 5: Extracting burner..."
BURNER=$(curl -s -X POST $NODE_URL/rpc -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"info_get_deploy\",\"params\":{\"deploy_hash\":\"$BURN_HASH\"},\"id\":1}" \
  | jq -r '.result.deploy.header.account')

echo "   Burner: $BURNER"

# STEP 6: Check metadata (will be null after burn)
echo ""
echo "📋 STEP 6: Checking metadata availability..."
echo "   ⚠️  Metadata is DELETED after burn"
echo "   ❌ Cannot retrieve metadata from burned NFT"
echo "   ✅ Must retrieve from MINT transaction"
echo ""

# SUMMARY
echo "============================================================"
echo "✅ VERIFICATION SUMMARY"
echo "============================================================"
echo ""
echo "Burn Deploy:  $BURN_HASH"
echo "Collection:   $CONTRACT_HASH ✅ VALID"
echo "Token ID:     $TOKEN_ID"
echo "Burner:       $BURNER"
echo "Status:       SUCCESS"
echo ""
echo "⚠️  METADATA RETRIEVAL:"
echo "   - Metadata is permanently deleted after burn"
echo "   - Must be retrieved from MINT transaction"
echo "   - Store mint deploy hash when minting"
echo "   - Or use an indexer to find mint transaction"
echo ""
echo "🔗 View on explorer:"
echo "   https://testnet.cspr.live/deploy/$BURN_HASH"
