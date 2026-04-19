#!/usr/bin/env bash
set -euo pipefail

IAPP_ADDRESS="${IAPP_ADDRESS:-}"
if [[ -z "$IAPP_ADDRESS" ]]; then
  echo "IAPP_ADDRESS is required"
  exit 1
fi

IAPP_CHAIN="${IAPP_CHAIN:-arbitrum-sepolia-testnet}"
PUBLIC_CONFIG_URL="${PUBLIC_CONFIG_URL:-}"
IAPP_ARGS="${IAPP_ARGS:-}"
PROTECTED_DATA_ADDRESSES="${PROTECTED_DATA_ADDRESSES:-}"

cmd=(iapp run "$IAPP_ADDRESS" --chain "$IAPP_CHAIN")

if [[ -n "$PUBLIC_CONFIG_URL" ]]; then
  cmd+=(--inputFile "$PUBLIC_CONFIG_URL")
fi

if [[ -n "$IAPP_ARGS" ]]; then
  cmd+=(--args "$IAPP_ARGS")
fi

if [[ -n "$PROTECTED_DATA_ADDRESSES" ]]; then
  IFS=',' read -r -a addrs <<< "$PROTECTED_DATA_ADDRESSES"
  for addr in "${addrs[@]}"; do
    if [[ -n "$addr" ]]; then
      cmd+=(--protectedData "$addr")
    fi
  done
fi

echo "Running: ${cmd[*]}"
exec "${cmd[@]}"
