#!/bin/bash
# Allow CEP-78 collections to be minted by authority_mint contract

NODE_ADDRESS="http://65.109.83.79:7777"
CHAIN_NAME="casper-test"
SECRET_KEY="../../Account 1_secret_key.pem"
PAYMENT_AMOUNT="3000000000"

AUTHORITY_MINT_HASH="b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc"

# Tixia 1/1 Collection (without 'contract-' prefix)
TIXIA_1O1_HASH="376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97"

# Tixia SFT Collection (without 'contract-' prefix)
TIXIA_SFT_HASH="e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0"

echo "🔐 Allowing Tixia 1/1 Collection..."
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$AUTHORITY_MINT_HASH" \
  --session-entry-point "allow_collection" \
  --session-arg "collection_hash:byte_array_32='$TIXIA_1O1_HASH'"

echo ""
echo "Waiting 30s..."
sleep 30

echo ""
echo "🔐 Allowing Tixia SFT Collection..."
casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-hash "$AUTHORITY_MINT_HASH" \
  --session-entry-point "allow_collection" \
  --session-arg "collection_hash:byte_array_32='$TIXIA_SFT_HASH'"

echo ""
echo "✅ Both collections allowed!"
