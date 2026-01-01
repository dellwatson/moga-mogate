# Casper Deployment Guide

This guide walks you through deploying Odra contracts to Casper testnet.

## Prerequisites

1. **Rust nightly** (Odra 2.4.0 requirement):

   ```bash
   rustup toolchain install nightly
   rustup override set nightly  # in repo root
   ```

2. **Casper CLI tools**:

   ```bash
   cargo install casper-client --locked
   cargo install cargo-odra --locked
   ```

3. **Testnet account**:

   - Get testnet CSPR from faucet: https://testnet.cspr.live/tools/faucet
   - Save your secret key as `.pem` file (e.g., `Account 1_secret_key.pem`)
   - Add to `.gitignore` to keep it safe

4. **Node access**:
   - Public testnet node: `http://65.109.222.111:7777`
   - Or use cspr.cloud API endpoint

## Get Your Account Address

Casper v5.0.0+ uses `--public-key` instead of `--secret-key`:

```bash
# Extract public key from PEM file first
casper-client account-address --public-key "Account 1_secret_key.pem"
```

Or use this helper to get both public key hex and account hash:

```bash
casper-client keygen "Account 1_secret_key.pem" --show-account
```

## Build Contract WASM

### Option 1: Single contract (faster)

```bash
cargo build --release --manifest-path contracts/+odra_another_mint/Cargo.toml --target wasm32-unknown-unknown
```

WASM output: `target/wasm32-unknown-unknown/release/ant_mint_test.wasm`

### Option 2: Using cargo-odra (recommended)

First, create `Odra.toml` in repo root:

```toml
[contracts]
ant_mint_test = { path = "contracts/+odra_another_mint" }
odra_authority_mint = { path = "contracts/+odra_authority_mint" }
```

Then build:

```bash
cargo odra build -b casper
```

WASM output: `wasm/ant_mint_test.wasm`

## Deploy to Testnet

### Step 1: Prepare deployment command

```bash
casper-client put-deploy \
  --node-address http://65.109.222.111:7777 \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 100000000000 \
  --session-path wasm/ant_mint_test.wasm \
  --session-arg "odra_cfg_package_hash_key_name:string:'ant_mint_test_package_hash'" \
  --session-arg "odra_cfg_allow_key_override:bool:'true'" \
  --session-arg "odra_cfg_is_upgradable:bool:'true'" \
  --session-arg "value:u64:'42'"
```

**Required Odra args:**

- `odra_cfg_package_hash_key_name` — Key name to store contract package hash
- `odra_cfg_allow_key_override` — Allow overwriting existing key
- `odra_cfg_is_upgradable` — Make contract upgradable

**Contract-specific args:**

- `value:u64:'42'` — Initial value for `AntMintTest::init()`

### Step 2: Wait for deploy to finalize

The command returns a deploy hash. Check status:

```bash
casper-client get-deploy \
  --node-address http://65.109.222.111:7777 \
  <DEPLOY_HASH>
```

Wait until `"execution_results"` shows success.

### Step 3: Get contract hash

Query your account to find the contract:

```bash
casper-client query-global-state \
  --node-address http://65.109.222.111:7777 \
  --state-root-hash <STATE_ROOT_HASH> \
  --key <YOUR_ACCOUNT_HASH> \
  -q "ant_mint_test_package_hash"
```

Save the contract hash for future interactions.

## Interact with Deployed Contract

### Call `set_value`

```bash
casper-client put-deploy \
  --node-address http://65.109.222.111:7777 \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 5000000000 \
  --session-hash <CONTRACT_HASH> \
  --session-entry-point "set_value" \
  --session-arg "value:u64:'100'"
```

### Query `get_value`

```bash
casper-client query-global-state \
  --node-address http://65.109.222.111:7777 \
  --state-root-hash <STATE_ROOT_HASH> \
  --key <CONTRACT_HASH> \
  -q "value"
```

## Troubleshooting

### Error: "Out of gas"

Increase `--payment-amount`:

- Deploy: 100-200 CSPR (`100000000000` - `200000000000` motes)
- Call: 5-10 CSPR (`5000000000` - `10000000000` motes)

### Error: "Invalid secret key"

Make sure your PEM file path is correct and the file contains:

```
-----BEGIN EC PRIVATE KEY-----
...
-----END EC PRIVATE KEY-----
```

### Contract not found

Wait 1-2 minutes after deploy before querying. Check deploy status first.

## Next Steps

1. Deploy `+odra_authority_mint` contract
2. Create NFT collection contracts under `contracts/$moga-collection/`
3. Deploy MOGA token (CEP-18)
4. Build TypeScript SDK for frontend integration
