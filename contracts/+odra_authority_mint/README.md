# Authority Mint - CEP-78 Delegated Minting

## Overview

Authority mint contract that can mint NFTs/SFTs into CEP-78 collections on behalf of users.

## Deployed Collections

### Tixia 1/1 Collection

- Contract: `contract-376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97`
- Package: `contract-package-d6cf6887321a367d431191cb886e404641d28635403d9f03ee2c93447eb88625`

### Tixia SFT Collection

- Contract: `contract-e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0`
- Package: `contract-package-3f7119b2fad23df857aed9a530380eddb0f30ac9ea369231b59e1941196e522e`

## Minting via CEP-78

CEP-78 collections are deployed with `minting_mode: 1` (PUBLIC), which means anyone can call the `mint` entrypoint.

To mint an NFT, use the CEP-78 `mint_session` client code:

```bash
casper-client put-deploy \
  --node-address http://65.109.83.79:7777 \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 5000000000 \
  --session-path mint_session/target/wasm32-unknown-unknown/release/mint_call.wasm \
  --session-arg "nft_contract_hash:key='hash-<CONTRACT_HASH>'" \
  --session-arg "token_owner:key='account-hash-<RECIPIENT>'" \
  --session-arg "token_meta_data:string='{\"name\":\"Flight Credit\",\"token_uri\":\"https://raw.githubusercontent.com/...\"}'"
```

## Backend Integration

Your faucet backend can:

1. Choose collection (1o1 or SFT)
2. Pick metadata URI from `metadata/v2-test/nfts/casper/tixia/...`
3. Call CEP-78 mint directly with user's account hash as `token_owner`

No separate authority_mint contract needed - CEP-78 PUBLIC minting mode allows direct minting.
