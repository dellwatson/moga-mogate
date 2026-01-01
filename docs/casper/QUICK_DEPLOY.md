# Quick Casper Deployment (Workaround for Odra build issues)

The Odra 2.4.0 WASM build is hitting a nightly Rust incompatibility. Here's how to deploy and test on Casper **right now**:

## Step 1: Get your account info

```bash
# This extracts your public key and account hash
casper-client keygen "Account 1_secret_key.pem"
```

Save the **account hash** (starts with `account-hash-...`).

## Step 2: Get testnet CSPR

Visit: https://testnet.cspr.live/tools/faucet

Enter your account hash and request tokens.

## Step 3: Deploy a pre-built CEP-18 token (MOGA test token)

Download a working CEP-18 WASM:

```bash
cd /tmp
wget https://github.com/casper-ecosystem/cep18/releases/download/v1.1.2/cep18.wasm
```

Deploy it:

```bash
casper-client put-deploy \
  --node-address https://rpc.testnet.casperlabs.io \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 200000000000 \
  --session-path /tmp/cep18.wasm \
  --session-arg "name:string='MOGA Test Token'" \
  --session-arg "symbol:string='MOGA'" \
  --session-arg "decimals:u8='9'" \
  --session-arg "total_supply:u256='1000000000000000000'"
```

This deploys a fungible token contract. You'll get a deploy hash - save it!

## Step 4: Check deploy status

```bash
casper-client get-deploy \
  --node-address https://rpc.testnet.casperlabs.io \
  <YOUR_DEPLOY_HASH>
```

Wait until `execution_results` shows success.

## Step 5: Find your contract hash

```bash
casper-client query-global-state \
  --node-address https://rpc.testnet.casperlabs.io \
  --state-root-hash <STATE_ROOT_FROM_DEPLOY> \
  --key <YOUR_ACCOUNT_HASH> \
  -q "cep18_contract_hash"
```

## Next: Fix Odra build

The issue is `odra-casper-wasm-env 2.4.0` is incompatible with latest nightly. Solutions:

1. **Wait for Odra 2.5.0** (check https://github.com/odradev/odra/releases)
2. **Use an older nightly** that works with Odra 2.4.0 (try `nightly-2024-05-01`)
3. **Fork and patch** `odra-casper-wasm-env` to remove the `#[no_mangle]` on panic handler

Once you've deployed the CEP-18 token and understand the flow, we can tackle the Odra build issue properly.
