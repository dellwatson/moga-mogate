#!/bin/bash

# Extract public key from PEM and convert to hex format for Casper
# This works with casper-client v5+

PEM_FILE="Account 1_secret_key.pem"

echo "Extracting public key from $PEM_FILE..."

# Extract the public key in hex format (raw bytes)
PUBLIC_KEY_HEX=$(openssl ec -in "$PEM_FILE" -pubout -outform DER 2>/dev/null | tail -c 65 | xxd -p -c 65)

echo ""
echo "Public Key (hex): $PUBLIC_KEY_HEX"
echo ""

# Get account hash using the hex public key
echo "Getting account address..."
ACCOUNT_HASH=$(casper-client account-address --public-key "$PUBLIC_KEY_HEX" 2>&1 | grep -o 'account-hash-[a-f0-9]*')

if [ -z "$ACCOUNT_HASH" ]; then
    echo "Failed to get account hash. Trying alternative method..."
    # Alternative: just show the public key hex for manual lookup
    echo "Use this public key hex on cspr.live to find your account:"
    echo "$PUBLIC_KEY_HEX"
else
    echo "Account Hash: $ACCOUNT_HASH"
    echo ""
    echo "Get testnet CSPR from: https://testnet.cspr.live/tools/faucet"
    echo "Paste this account hash: $ACCOUNT_HASH"
fi
