# Setup Scripts (Per Program)

These scripts are organized by `program.step_action`.

## Central Config

Update this file once:
- `scripts/setup/setup.config.ts`

It controls:
- Dynamic setup labels (e.g. `arc721_collection_privateV2`)
- Program IDs/directories
- Default admin/backend/treasury
- Network/endpoint/private key fallback
- Collection default caps/symbol

## 1) ARC721 Private Collection

### `arc721_collection_private.01_initialize.ts|sh`
Initializes collection admin + caps + symbol.

Required inputs:
- `--admin <aleo-address>` (or set `accounts.adminAddress` in `setup.config.ts`)
- `--max-mintable <u64>` (default from `setup.config.ts`)
- `--max-first-edition <u64>` (default from `setup.config.ts`)
- `--symbol <field>` (default from `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
bash scripts/setup/arc721_collection_private.01_initialize.sh \
  --admin aleo1... \
  --max-mintable 0 \
  --max-first-edition 0 \
  --symbol 999field \
  --private-key "$ALEO_PVT_KEY"
```

### `arc721_collection_private.02_set_minter.ts|sh`
Whitelists the gateway (or any minter) in the collection.

Required inputs:
- `--minter <aleo-address-or-program>` (default from `setup.config.ts`)
- `--allowed true|false` (default from `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
bash scripts/setup/arc721_collection_private.02_set_minter.sh \
  --minter mogate_authority_mint_v3.aleo \
  --allowed true
```

## 2) Authority Mint Gateway

### `authority_mint_gateway.01_initialize.ts|sh`
Gateway currently has no `initialize` transition. This script validates the program exists on network and prints setup status.

Optional input:
- `--program <program-id>` (default from `setup.config.ts`)

Example:
```bash
bash scripts/setup/authority_mint_gateway.01_initialize.sh
```

## 3) Dark Pool Raffle Private

### `dark_pool_raffle_private._initialize.ts|sh`
Initializes raffle admin/backend/treasury.

Required inputs:
- `--admin <aleo-address>` (or set in `setup.config.ts`)
- `--backend <aleo-address>` (or set in `setup.config.ts`)
- `--treasury <aleo-address>` (or set in `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
bash scripts/setup/dark_pool_raffle_private._initialize.sh \
  --admin aleo1... \
  --backend aleo1... \
  --treasury aleo1... \
  --private-key "$ALEO_PVT_KEY"
```

## Dry Run

For scripts that send a transaction, add `--dry-run` to print inputs without broadcasting.
