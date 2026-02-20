#!/bin/bash
# Scan BurnReceipt records owned by the backend account

set -e

# Load environment
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

PROGRAM_NAME="${1:-mogate_arc721_private.aleo}"
RECORD_NAME="${2:-BurnReceipt}"
MAX_RECORDS="${3:-20}"
START_HEIGHT="${4:-0}"
END_HEIGHT="${5:-}"

echo "🔎 Scanning burn receipts..."
echo ""

if [ -n "$END_HEIGHT" ]; then
    bun ts-sdk/src/scripts/burn-receipts.ts "$PROGRAM_NAME" "$RECORD_NAME" "$MAX_RECORDS" "$START_HEIGHT" "$END_HEIGHT"
else
    bun ts-sdk/src/scripts/burn-receipts.ts "$PROGRAM_NAME" "$RECORD_NAME" "$MAX_RECORDS" "$START_HEIGHT"
fi
