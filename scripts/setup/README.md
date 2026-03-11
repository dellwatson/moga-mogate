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

## 1) ARC721 Private Collection (Legacy)

### `arc721_collection_private.01_initialize.ts`
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
node scripts/setup/arc721_collection_private.01_initialize.ts \
  --admin aleo1... \
  --max-mintable 0 \
  --max-first-edition 0 \
  --symbol 999field \
  --private-key "$ALEO_PVT_KEY"
```

### `arc721_collection_private.02_set_minter.ts`
Whitelists the gateway (or any minter) in the collection.

Required inputs:
- `--minter <aleo-address-or-program>` (default from `setup.config.ts`)
- `--allowed true|false` (default from `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/arc721_collection_private.02_set_minter.ts \
  --minter mogate_authority_mint_v3.aleo \
  --allowed true
```

## 2) ARC721 Multi Private Collection (Recommended)

### `arc721_multi_private.01_initialize.ts`
Initializes the multi-collection program (sets the program admin).

Required inputs:
- `--admin <aleo-address>` (or set `accounts.adminAddress` in `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/arc721_multi_private.01_initialize.ts \
  --admin aleo1... \
  --private-key "$ALEO_PVT_KEY"
```

### `arc721_multi_private.02_create_collection.ts`
Registers a new collection in the multi program.

Required inputs:
- `--collection <field>` (default from `setup.config.ts`)
- `--admin <aleo-address>` (collection admin; default from `setup.config.ts`)
- `--name <string>` (default from `setup.config.ts`)
- `--symbol <string>` (default from `setup.config.ts`)
- `--metadata-url <string>` (default from `setup.config.ts`)
- `--bridged true|false` (default from `setup.config.ts`)
- `--origin-chain <u32>` (default from `setup.config.ts`)
- `--origin-collection <string>` (default from `setup.config.ts`)
- `--max-mintable <u64>` (default from `setup.config.ts`)
- `--max-first-edition <u64>` (default from `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/arc721_multi_private.02_create_collection.ts \
  --collection 1field \
  --name "Mogate One" \
  --symbol "MOGA" \
  --metadata-url "https://example.com/collection.json"
```

### `arc721_multi_private.03_set_minter.ts`
Whitelists a minter for a specific collection.

Required inputs:
- `--collection <field>` (default from `setup.config.ts`)
- `--minter <aleo-address-or-program>` (default from `setup.config.ts`)
- `--allowed true|false` (default from `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/arc721_multi_private.03_set_minter.ts \
  --collection 1field \
  --minter mogate_authority_mint_v4.aleo \
  --allowed true
```

## 3) Authority Mint Gateway

### `authority_mint_gateway.01_initialize.ts`
Gateway currently has no `initialize` transition. This script validates the program exists on network and prints setup status.

Optional input:
- `--program <program-id>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/authority_mint_gateway.01_initialize.ts
```

## 4) Dark Pool Raffle Private

### `dark_pool_raffle_private._initialize.ts`
Initializes raffle admin/backend/treasury.

Required inputs:
- `--admin <aleo-address>` (or set in `setup.config.ts`)
- `--backend <aleo-address>` (or set in `setup.config.ts`)
- `--treasury <aleo-address>` (or set in `setup.config.ts`)
- `--program-dir <path>` (default from `setup.config.ts`)
- `--private-key <aleo-private-key>` (default from `setup.config.ts`)

Example:
```bash
node scripts/setup/dark_pool_raffle_private._initialize.ts \
  --admin aleo1... \
  --backend aleo1... \
  --treasury aleo1... \
  --private-key "$ALEO_PVT_KEY"
```

## 5) Bridge Gateway (Aleo)

### `bridge_gateway.01_initialize.ts`
Initializes bridge admin + relayer signer.

Example:
```bash
node scripts/setup/bridge_gateway.01_initialize.ts \
  --admin aleo1... \
  --relayer aleo1...
```

### `bridge_gateway.02_set_relayer.ts`
Updates the relayer signer.

Example:
```bash
node scripts/setup/bridge_gateway.02_set_relayer.ts \
  --relayer aleo1...
```

## Dry Run

For scripts that send a transaction, add `--dry-run` to print inputs without broadcasting.
