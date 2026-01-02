# Casper Scripts

TypeScript scripts for interacting with Casper contracts.

## Available Scripts

### Mint NFT

```bash
bun run casper:mint-nft [RECIPIENT_ACCOUNT_HASH]
```

Mints an NFT via the authority mint contract.

- If no recipient provided, mints to deployer account
- Uses Tixia 1/1 collection by default

### Validate Burn

```bash
bun run casper:validate-burn <BURN_TX_HASH>
```

Validates a burn transaction and extracts:

- Metadata URI
- Last owner
- Token ID
- Collection info

### Build Authority Mint

```bash
bun run casper:build-authority-mint
```

Builds the authority mint contract WASM.

### Deploy Authority Mint

```bash
bun run casper:deploy-authority-mint
```

Deploys the authority mint contract to testnet.

### Allow Collections

```bash
bun run casper:allow-collections
```

Whitelists Tixia collections in authority mint contract.

### Deploy Collection (1/1)

```bash
bun run casper:deploy-collection-1o1
```

Deploys Tixia 1/1 CEP-78 collection.

### Deploy Collection (SFT)

```bash
bun run casper:deploy-collection-sft
```

Deploys Tixia SFT CEP-78 collection.

### Deploy All

```bash
bun run casper:deploy-all
```

Builds and deploys authority mint + allows collections.

## Examples

### Mint NFT to specific recipient

```bash
bun run casper:mint-nft 1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8
```

### Validate a burn

```bash
bun run casper:validate-burn abc123def456...
```

## Configuration

Scripts use:

- **Keys:** `Account 1_secret_key.pem` in repo root
- **Network:** Casper testnet
- **RPC:** http://65.109.83.79:7777
- **Chain:** casper-test

## Deployed Contracts

- **Authority Mint:** `contract-b50dc5da60d9836fc36ae4250ebc11c40baae5d347030d29c8dc8ee937e1c2dc`
- **Tixia 1/1:** `contract-376fb8f9264fd7cf232a3ee43c43ff606b30b89cbb92eda0f2537513b1463c97`
- **Tixia SFT:** `contract-e3699ea7bbbcc74018b0c24d3557c6cfd34b9c30405cf4cf4bae3dfc589ccea0`
