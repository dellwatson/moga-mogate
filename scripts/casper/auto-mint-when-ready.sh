#!/bin/bash

echo "🚀 Auto-Mint Monitor: Waiting for contracts to deploy..."
echo "This will check every 30 seconds and run mints when ready."
echo ""
echo "Press Ctrl+C to stop monitoring."
echo ""

MAX_ATTEMPTS=20  # 10 minutes max
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "[$ATTEMPT/$MAX_ATTEMPTS] Checking deployment status..."
  
  # Run extraction script
  ./scripts/casper/extract-contract-hashes.sh > /tmp/extract-output.txt 2>&1
  
  # Check if both contracts are ready
  if grep -q "BOTH CONTRACTS DEPLOYED" /tmp/extract-output.txt; then
    echo ""
    echo "============================================================"
    echo "✅ CONTRACTS READY! Running mints..."
    echo "============================================================"
    echo ""
    
    # Show the contract hashes
    cat deployment-casper/CONTRACT-HASHES.json
    echo ""
    
    # Run direct mint
    echo "============================================================"
    echo "1️⃣  DIRECT MINT ON PUBLIC CEP-95"
    echo "============================================================"
    echo ""
    node scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js
    
    echo ""
    echo "Waiting 10 seconds before delegate mint..."
    sleep 10
    echo ""
    
    # Run delegate mint
    echo "============================================================"
    echo "2️⃣  DELEGATE MINT (Authority Mint → PUBLIC CEP-95)"
    echo "============================================================"
    echo ""
    node scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js
    
    echo ""
    echo "============================================================"
    echo "✅ ALL MINTS COMPLETED!"
    echo "============================================================"
    echo ""
    echo "Check results:"
    echo "- deployment-casper/PUBLIC-CEP95-MINT-PROOF.json"
    echo "- deployment-casper/PUBLIC-CEP95-DELEGATE-MINT-PROOF.json"
    echo ""
    
    exit 0
  fi
  
  # Still pending
  echo "⏳ Contracts still deploying... waiting 30 seconds"
  echo ""
  sleep 30
done

echo ""
echo "⚠️  Timeout: Contracts took too long to deploy."
echo "Check manually:"
echo "- https://testnet.cspr.live/deploy/f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136"
echo "- https://testnet.cspr.live/deploy/bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965"
