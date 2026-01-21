# CSPR Transfer Contract Purse

Second variant of the CSPR transfer contract that **holds CSPR inside the contract**.

- Contract creates its own purse on `init`
- Users call `deposit_from_purse(amount, source_purse)` to move CSPR into that purse
- You can query the balance with `get_purse_balance`

For testing, you can pass your main purse URef as `source_purse`.

## Build

```bash
cd contracts/cspr_transfer_proxy_contract_purse
cargo build --release --target wasm32-unknown-unknown
```

Wasm: `target/wasm32-unknown-unknown/release/cspr_transfer_contract_purse.wasm`

## Deploy (Account 1)

```bash
casper-client put-deploy \
  --node-address https://node.testnet.casper.network \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 100000000000 \
  --session-path contracts/cspr_transfer_proxy_contract_purse/target/wasm32-unknown-unknown/release/cspr_transfer_contract_purse.wasm
```

After deploy finalizes, get the contract hash from the deploy details.

## Deposit from Account 1 main purse

You already have Account 1 main purse URef in `deployment-casper/ACCOUNT-INFO-*.json`:

```text
uref-00c640d622bc5d7aa037062bfc9cc5f10f19107455a4e7f9eadceea993886568-007
```

Example: deposit 5 CSPR (5 \* 10^9 motes):

```bash
casper-client put-deploy \
  --node-address https://node.testnet.casper.network \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 2500000000 \
  --session-hash <contract-hash> \
  --session-entry-point "deposit_from_purse" \
  --session-arg "amount:u512='5000000000'" \
  --session-arg "source_purse:uref='uref-00c640d622bc5d7aa037062bfc9cc5f10f19107455a4e7f9eadceea993886568-007'"
```

## Check contract purse balance

```bash
casper-client put-deploy \
  --node-address https://node.testnet.casper.network \
  --chain-name casper-test \
  --secret-key "Account 1_secret_key.pem" \
  --payment-amount 2500000000 \
  --session-hash <contract-hash> \
  --session-entry-point "get_purse_balance"
```

The result will be in the deploy execution result.
