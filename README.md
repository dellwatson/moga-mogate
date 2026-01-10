# Mogate RWA Platform - Multi-chain RWA Raffle

This monorepo contains the Mogate RWA raffle platform across multiple chains. Each network has its own git branch with network-specific programs, SDKs, and offchain workers.

## Network Branches

This is a cross-chain project. Each blockchain has its own branch:

- **`main` / `svm`** — Solana implementation
- **`casper-network`** — Casper Network implementation
- **`evm-network`** — EVM implementation (LISK, polygon, base, etc )
- **`starknet`** — Cairo VM implementation
- **`move-vm`** — Sui and APTOS
- **`tvm`** — Tron
- **`bridge-hub`** — Cross-chain middleware / bridging layer

**Switch branches to view network-specific code and documentation.**

---

# EVM RWA Raffle (Sepolia / Polygon Amoy / Lisk-Sepolia)

This branch contains the **EVM implementation** of the Mogate RWA raffle system:

- NFT collections on EVM chains (ERC-721, optional ERC-1155).
- Authority minting (direct gateway + backend-signed permits).
- Multi-raffle engine using native gas tokens (ETH / MATIC / Lisk-Sepolia gas).
- Scripts to deploy, mint, burn, and verify burns on testnets.

## Contracts

- `contracts/Collection.sol` — ERC-721 collection

  - Owner/operator model with `setMinter` to grant mint rights.
  - `mintWithTokenId` so offchain can choose unix-ms token IDs.
  - `burn` for owner / approved.

- `contracts/Collection1155.sol` — ERC-1155 collection

  - Optional per-token URIs.
  - Minting and burn support for batch-style assets.

- `contracts/AuthorityMintWithPermit.sol`

  - Authority that mints into a single collection using ECDSA permits signed by a backend.
  - Offchain service signs `(contract, recipient, uri, nonce, expiry)`; users submit via `mintWithPermit`.

- `contracts/AuthorityMintGateway.sol`

  - Collection-agnostic gateway mainly for **testing / faucet** flows.
  - Owner-gated `mint` for allow-listed collections.
  - Looser `mint_nft` helper for local faucets / scripts.

- `contracts/Raffle.sol`
  - EVM implementation of the chain-agnostic spec in `RAFFLE.md`.
  - Uses:
    - `raffleId: string` (hashed to `bytes32` key),
    - explicit numbered slots per raffle,
    - native token payments,
    - external collection via `ICollectionMint.mintWithTokenId`.
  - Core flows:
    - `hostRaffle(...)` — create raffle with `totalSlots`, `maxSlotsPerAddress`, `pricePerSlot`, `metadataUri`, `collection`, `autoClaim`, `expiresAt`.
    - `joinRaffle(raffleId, slotIds)` — user pays native token and buys specific free slots.
    - `unsafeJoinHostRaffle(...)` — host + join + optional free slots in one tx.
    - `claim(raffleId)` — winner mints prize if `autoClaim == false`.
    - `withdrawProceeds(to, amount)` — owner withdraws accumulated native tokens.
  - View helpers:
    - `getRaffleLoad`, `getUserRaffles`, `getUserRaffleSlots`, `checkSlotsAvailability`.

See `RAFFLE.md` for the chain-agnostic spec that this contract follows.

## Scripts (bun + ethers v6)

All scripts live under `scripts/` and are intended to be run with bun:

- `1-deploy-collection.ts` — deploy `Collection.sol`.
- `2-deploy-authority-mint.ts` — deploy basic `AuthorityMint` (single-collection authority).
- `3-deploy-authority-mint-permit.ts` — deploy `AuthorityMintWithPermit`.
- `4-deploy-raffle.ts` — deploy `Raffle.sol`.
- `5-burn-nft.ts` — burn ERC-721 / ERC-1155 tokens.
- `6-verify-burn-from-tx.ts` — read burn tx, recover pre-burn metadata URI.
- `7-mint-from-collection.ts` — direct mint via `Collection`.
- `8-mint-from-authority.ts` — mint via authority contract.

Examples:

```bash
bun scripts/1-deploy-collection.ts
bun scripts/4-deploy-raffle.ts
bun scripts/7-mint-from-collection.ts
bun scripts/8-mint-from-authority.ts
```

For concrete deployments (addresses + tx hashes), see:

- `SEPOLIA_DEPLOYMENT_RECORD.md`
- `lisk-amoy.md`

## Networks / deployment records

- **Ethereum Sepolia**

  - Full flow exercised: deploy, mint (direct + authority), burn, verify burn.
  - Detailed log: `SEPOLIA_DEPLOYMENT_RECORD.md`.

- **Polygon Amoy**

  - Collection + AuthorityMint deployed and sample NFT minted.
  - Details: `lisk-amoy.md` (Polygon Amoy section).

- **Lisk-Sepolia**
  - Collection + AuthorityMint deployed and sample NFT minted.
  - Details: `lisk-amoy.md` (Lisk-Sepolia section).

## Prereqs (EVM)

- Node.js 22.x (Hardhat 3 compatible).
- Bun >= 1.0 (for running scripts).
- RPC endpoints for at least one EVM testnet (e.g. Sepolia, Polygon Amoy, Lisk-Sepolia).
- Environment variables (for scripts):
  - `SEPOLIA_RPC_URL`
  - `PRIVATE_KEY_ETH` (deployer / authority owner)
  - `PRIVATE_KEY_ETH_2` (end-user wallet for mint/burn scripts)
  - `COLLECTION_ADDRESS`, `AUTHORITY_MINT_ADDRESS`, `TOKEN_URI`, `TOKEN_ID` as required by specific scripts.

## Dev notes

- Contracts use OpenZeppelin Contracts v5, Solidity `^0.8.20`, Hardhat with `viaIR` enabled.
- All EVM scripts use `ethers` v6 directly (no Hardhat runtime).
- Token IDs are typically unix-ms timestamps chosen offchain.
- Metadata URIs point at GitHub raw JSON files under `metadata/v2-test/...`.
- The raffle engine is designed to mirror the Casper / Solana logic so the same offchain raffle service can target multiple chains.
