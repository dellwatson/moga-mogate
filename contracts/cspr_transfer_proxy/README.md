# CSPR Transfer Proxy Contract

A simple Casper smart contract that acts as a proxy for transferring CSPR tokens to a whitelisted vault address.

## Features

- ✅ Whitelist a vault address during deployment
- ✅ Transfer CSPR through the contract to the vault
- ✅ Update vault address (by contract owner)
- ✅ Query current vault address

## Build

```bash
cd contracts/cspr_transfer_proxy
cargo build --release --target wasm32-unknown-unknown
```

The compiled WASM will be at: `target/wasm32-unknown-unknown/release/cspr_transfer_proxy.wasm`

## Deploy

```bash
casper-client put-deploy \
  --node-address http://65.109.222.229:7777 \
  --chain-name casper-test \
  --secret-key <your-secret-key.pem> \
  --payment-amount 100000000000 \
  --session-path target/wasm32-unknown-unknown/release/cspr_transfer_proxy.wasm \
  --session-arg "vault_address:account_hash='account-hash-<vault-address>'" \
  --session-arg "contract_name:string='cspr_transfer_proxy'"
```

## Usage

### Transfer CSPR to Vault

Users call this to send CSPR through the contract to the whitelisted vault:

```bash
casper-client put-deploy \
  --node-address http://65.109.222.229:7777 \
  --chain-name casper-test \
  --secret-key <user-secret-key.pem> \
  --payment-amount 2500000000 \
  --session-hash <contract-hash> \
  --session-entry-point "transfer_to_vault" \
  --session-arg "amount:u512='1000000000'"
```

### Update Vault Address

Only the contract owner can update the vault:

```bash
casper-client put-deploy \
  --node-address http://65.109.222.229:7777 \
  --chain-name casper-test \
  --secret-key <owner-secret-key.pem> \
  --payment-amount 2500000000 \
  --session-hash <contract-hash> \
  --session-entry-point "update_vault" \
  --session-arg "vault_address:account_hash='account-hash-<new-vault>'"
```

### Query Vault Address

```bash
casper-client query-global-state \
  --node-address http://65.109.222.229:7777 \
  --state-root-hash <state-root-hash> \
  --key <contract-hash> \
  -q "vault_address"
```

## Contract Entry Points

1. **transfer_to_vault** - Transfer CSPR to the whitelisted vault
   - Parameters: `amount: U512`
   - Access: Public

2. **update_vault** - Update the vault address
   - Parameters: `vault_address: AccountHash`
   - Access: Public (but should be restricted in production)

3. **get_vault** - Get the current vault address
   - Parameters: None
   - Returns: `AccountHash`
   - Access: Public

## Security Notes

⚠️ **Important**: The `update_vault` entry point is currently public. For production, you should add access control to restrict this to only the contract owner/admin.

## Example Flow

1. Deploy contract with vault address: `account-hash-abc123...`
2. User sends 10 CSPR through contract
3. Contract automatically forwards to vault
4. Vault receives 10 CSPR

## Why This Approach?

This is the **simpler** option because:

- ✅ No need to manage contract purse
- ✅ Direct transfer to vault
- ✅ Less gas costs
- ✅ Simpler logic and fewer edge cases
- ✅ Users don't need to interact with contract purse

The alternative (holding funds in contract) would require:

- Managing contract purse
- Withdrawal mechanisms
- More complex accounting
- Higher gas costs
