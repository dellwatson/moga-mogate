# Scripts + SDK Layout

`ts-sdk` is now module-only (no `ts-sdk/src/scripts`).

- Reusable frontend/offchain module: `ts-sdk/src/modules/index.ts`
- Domain split:
  - `ts-sdk/src/modules/mint.ts`
  - `ts-sdk/src/modules/raffle.actions.ts`
  - `ts-sdk/src/modules/raffle.views.ts`
  - `ts-sdk/src/modules/shared.ts`
- CLI/task runners: `scripts/*.ts`, `scripts/raffle_basic/*.ts`, `scripts/raffle_adv/*.ts`

## Core Module Functions

From `ts-sdk/src/modules/index.ts`:

- `mintPrivateViaGateway`
- `mintFaucet`
- `initializeRafflePrivate`
- `hostRaffleUnsafe`
- `joinRaffleUnsafe`
- `drawRaffle`
- `claimRafflePrize`
- `getRaffleDetail`
- `getRaffleSlots`
- `getUserTickets`

`getRaffleSlots` reads slot status via RPC mapping queries (`slot_taken`) and hash helpers, not via an on-chain view function.

## Example Root Scripts

- Mint via gateway: `scripts/01_mint_private_gateway.ts`
- Mint faucet flow: `scripts/01b_mint_faucet.ts`
- Raffle host/join/draw/claim:
  - `scripts/raffle_basic/02_host.ts`
  - `scripts/raffle_basic/03_join.ts`
  - `scripts/raffle_basic/07_draw.ts`
  - `scripts/raffle_basic/08_claim.ts`
- Raffle views:
  - `scripts/raffle_basic/04_status.ts`
  - `scripts/raffle_basic/05_slots.ts`
  - `scripts/raffle_basic/06_user_tickets.ts`

## Data Input (NFT Struct)

Use:
- `scripts/mint_private.sample_data.leo`

And pass with:
- `--data-file scripts/mint_private.sample_data.leo`

## Permit + Encryption Scripts

For `programs/authority_mint_gateway_permit`:

- Encrypt backend signer key:
  - `bun run scripts/12_encrypt_signer_key.ts --secret "<secret>" --out signer-key.ciphertext`
- Decrypt backend signer key:
  - `bun run scripts/13_decrypt_signer_key.ts --ciphertext-file signer-key.ciphertext --secret "<secret>" --print-private-key`
- Sign permit data:
  - `bun run scripts/14_sign_mint_permit.ts --recipient <aleo_address> --nft-commit <field> --nonce <u64> --ciphertext-file signer-key.ciphertext --secret "<secret>" --json`
- Execute permit mint:
  - `bun run scripts/15_mint_private_with_permit.ts --to <aleo_address> --data-file scripts/mint_private.sample_data.leo --edition 1 --nonce <u64> --signer <aleo_signer_address> --signature <sign1...>`

The permit script signs typed Leo data:
`{recipient: address, nft_commit: field, nonce: u64}`
which is the exact message verified in `mint_private_with_permit`.
