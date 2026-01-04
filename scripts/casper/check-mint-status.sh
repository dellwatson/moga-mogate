#!/bin/bash
# Check mint deploy status

DEPLOY_HASH="${1:-2f095e34baa8d02294627ec04b2e9bccb3ff3c61026736dff11767e69cbed654}"
NODE_ADDRESS="http://65.109.83.79:7777"

echo "🔍 Checking deploy status: $DEPLOY_HASH"
echo ""

casper-client get-deploy \
  --node-address "$NODE_ADDRESS" \
  "$DEPLOY_HASH"
