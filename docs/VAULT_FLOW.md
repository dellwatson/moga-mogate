# Privacy Flows (Vault + Darkpool Raffle V2)

This repo adds 2 user-facing privacy systems:

- **Private Vault (coFHE):** the vault holds the NFT on-chain, while the *real owner* is tracked as an **encrypted address**.
- **Darkpool Raffle V2 + Relayer:** slot ownership is stored **encrypted**, and a **relayer** is the visible on-chain sender.

## Why We Need Privacy

- Keep the UX nice (people can still see which slots are taken, and prizes still exist).
- Hide sensitive links:
  - who owns which slot
  - who owns the prize after winning
  - private transfers of ownership rights (without broadcasting "Alice -> Bob NFT")
- Reduce targeting / copy-trading / doxxing from public raffle participation history.
- Make later phases possible (V3/V4): tradable slots, then confidential trading.

Important: on EVM, **tx senders still exist**. Privacy here is mainly: "observers cannot learn balances/owners/positions from on-chain state or calldata because those values are ciphertext." A relayer helps reduce address-linkability in the UI/UX.

## Contracts

- `contracts/Vault.erc721.sol` (`MogateERC721Vault`)
  - Holds ERC721s.
  - Stores real owner as encrypted `eaddress`.
  - Supports vault-only transfers (no ERC721 Transfer).
  - Supports burn/unshield via executor, with audit events.

- `contracts/Raffle.vault.v1.sol` (`RaffleWithVaultV1`)
  - Same as V1 raffle, plus `claimToVault(...)` so prizes can go private immediately.

- `contracts/Raffle.darkpool.v2.vault.sol` (`RaffleDarkpoolV2WithVault`)
  - Darkpool raffle foundation + `claimToVault(...)`.

## User Flows (Simple)

### A) Private Vault (User View)

![vault-user-flow](./images/vault-user-flow.png)

Plain-English:

1. You deposit your NFT into the **Vault**.
2. The blockchain shows: "Vault owns the NFT" (public).
3. Inside the vault, your real ownership is stored as **encrypted** data (private).
4. While the NFT stays in the vault, you can:
   - privately transfer ownership rights to someone else
   - privately request burn (then executor completes burn)
5. If you withdraw (unshield), the NFT becomes publicly owned again (privacy ends for that NFT).

### B) Darkpool Raffle V2 + Relayer (User View)

![dp-raffle-user-flow](./images/dp-raffle-user-flow.png)

Plain-English:

1. You pick slot numbers in the UI.
2. A **relayer** sends the join transaction (so the explorer shows the relayer as sender).
3. Everyone can see which slot numbers are taken (public occupancy).
4. But the owner of each taken slot is stored **encrypted** (private).
5. If your slot wins, you claim the prize, ideally **to the vault** so the prize stays private.

## Tech Diagrams (Optional)

These are helpful for devs and audits, but not required to understand the user experience.

![vault-tech-flow](./images/vault_tech_flow.png)

![dp-raffle-tech-flow](./images/dp-raffle-tech-flow.png)

## Flows

### 1) Claim Reward To Vault (Recommended For Privacy)

1. Winner calls `claimToVault(raffleId, vault, encryptedOwner)` on the raffle contract.
2. Raffle mints the ERC721 prize to `vault`.
3. Raffle calls `vault.finalizeReceivedERC721(collection, tokenId, encryptedOwner)` to bind encrypted beneficial ownership.

Result:
- On-chain ERC721 owner is `vault`.
- Beneficial owner is ciphertext; only allowed decryptors (e.g. backend observer) can learn it.

### 2) Shield An Existing ERC721 (User Deposits)

Option A (1-tx): user calls `safeTransferFrom(..., vault, tokenId, encryptedOwnerBytes)`.
- The vault reads `data` inside `onERC721Received` and sets encrypted beneficial owner immediately.

Option B (2-tx): user calls `safeTransferFrom(..., vault, tokenId, "")`, then calls:
- `vault.finalizeReceivedERC721(collection, tokenId, encryptedOwnerBytes)` (must be the same transfer operator)

### 3) Vault-Only Private Transfers (No NFT Movement)

Beneficial owner calls:
- `vault.transferBeneficialOwnerERC721(collection, tokenId, encryptedNewOwner)`

This rotates the encrypted owner ciphertext (no `Transfer` event on the ERC721).

### 4) Burn From Vault (Forward Burn Data)

1. Beneficial owner calls `vault.requestBurnERC721(collection, tokenId)`.
2. An executor/relayer calls `vault.executeBurnERC721(collection, tokenId)`.

The vault emits:
- `BurnExecuted(collection, tokenId, executor, ownerCipher, tokenUri)`

### 5) Unshield (Withdraw Back To Public Ownership)

Executor/relayer calls:
- `vault.executeUnshieldERC721(collection, tokenId, to)`

After this, the ERC721 is owned publicly by `to` (not private anymore).

## Backend/Observer Notes

The vault has an `observer` address (set at deploy, or via `setObserver`). Whenever a ciphertext is stored/updated, the vault calls:
- `FHE.allow(ciphertext, observer)`

This allows the backend to decrypt encrypted beneficial owner / request flags off-chain using the coFHE SDK.

## Scripts

Vault:
- `bun run evm:deploy:vault:erc721`
- `bun run evm:vault:set-executor`
- `bun run evm:vault:shield`
- `bun run evm:vault:transfer-owner`
- `bun run evm:vault:burn:request`
- `bun run evm:vault:burn:execute`
- `bun run evm:vault:unshield:execute`

Raffles:
- `bun run evm:deploy:raffle:v1-vault`
- `bun run evm:deploy:raffle:v2-darkpool-vault`
- `bun run evm:raffle:v1:claim-to-vault`
- `bun run evm:raffle:v2:claim-to-vault`
