# Scripts + SDK Layout

`ts-sdk` is now module-only (no `ts-sdk/src/scripts`).

- Reusable frontend/offchain module: `ts-sdk/src/modules/index.ts`
- Domain split:
  - `ts-sdk/src/modules/mint.ts`
  - `ts-sdk/src/modules/raffle.actions.ts`
  - `ts-sdk/src/modules/raffle.views.ts`
  - `ts-sdk/src/modules/shared.ts`
- CLI/task runners: `scripts/*.ts`

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
  - `scripts/05_raffle_host.ts`
  - `scripts/06_raffle_join.ts`
  - `scripts/10_raffle_draw.ts`
  - `scripts/11_raffle_claim.ts`
- Raffle views:
  - `scripts/07_raffle_status.ts`
  - `scripts/08_raffle_slots.ts`
  - `scripts/09_raffle_user_tickets.ts`

## Data Input (NFT Struct)

Use:
- `scripts/mint_private.sample_data.leo`

And pass with:
- `--data-file scripts/mint_private.sample_data.leo`
