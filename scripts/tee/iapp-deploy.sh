#!/usr/bin/env bash
set -euo pipefail

IAPP_CHAIN="${IAPP_CHAIN:-arbitrum-sepolia-testnet}"
IAPP_PROJECT_DIR="${IAPP_PROJECT_DIR:-ts-sdk/iexec/raffle-privacy}"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-}"
DOCKERHUB_ACCESS_TOKEN="${DOCKERHUB_ACCESS_TOKEN:-${DOCKERHUB_TOKEN:-}}"
IAPP_APP_SECRET="${IAPP_APP_SECRET:-}"
IAPP_WALLET_PRIVATE_KEY="${IAPP_WALLET_PRIVATE_KEY:-}"

if [[ ! -f "$IAPP_PROJECT_DIR/iapp.config.json" ]]; then
  echo "iapp.config.json not found in $IAPP_PROJECT_DIR"
  exit 1
fi

node -e "const fs=require('fs'); const path=require('path'); const fp=path.join(process.cwd(), '$IAPP_PROJECT_DIR', 'iapp.config.json'); const data=JSON.parse(fs.readFileSync(fp,'utf8')); const set=(k,v)=>{ if(v!==undefined && v!=='' ){ data[k]=v; } }; const pk=process.env.IAPP_WALLET_PRIVATE_KEY; if(pk){ data.walletPrivateKey = pk.startsWith('0x')?pk:`0x${pk}`; } set('dockerhubUsername', process.env.DOCKERHUB_USERNAME); set('dockerhubAccessToken', process.env.DOCKERHUB_ACCESS_TOKEN); if(process.env.IAPP_APP_SECRET!==undefined && process.env.IAPP_APP_SECRET!==''){ data.appSecret = process.env.IAPP_APP_SECRET; } else if (process.env.IAPP_APP_SECRET===''){ data.appSecret = null; } fs.writeFileSync(fp, JSON.stringify(data, null, 2));"

pushd "$IAPP_PROJECT_DIR" >/dev/null
echo "Running iapp deploy on chain: $IAPP_CHAIN"
echo "Note: you will be prompted to confirm tx fees and set an iApp version."
iapp deploy --chain "$IAPP_CHAIN"
popd >/dev/null
