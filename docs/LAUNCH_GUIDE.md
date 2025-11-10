# Launch Guide: Devnet + Local Test

This guide walks you through setting up devnet and local testing to launch MOGA token, refund tickets (MRFT), RWA prize NFTs, and a raffle. It also covers the offchain worker and organizer setup.

## Prerequisites

- Solana CLI (devnet configured):
  - `solana config set --url https://api.devnet.solana.com`
- Anchor 0.31.x
- Bun (for ts-sdk tests and offchain scripts)
- Keypair with some devnet SOL in `~/.config/solana/id.json`
- Program ID set in `Anchor.toml` and `declare_id!()` (already done)

## 1) Create Devnet Tokens

We recommend SPL-Token for compatibility. Token-2022 optional if you need extensions.

- USDC (SPL, 6 decimals) and MOGA (SPL, 9 decimals):
```
spl-token create-token --decimals 6            # -> USDC_DEV_MINT
spl-token create-account <USDC_DEV_MINT>
spl-token mint <USDC_DEV_MINT> 1000000000      # 1,000 USDC

spl-token create-token --decimals 9            # -> MOGA_DEV_MINT
spl-token create-account <MOGA_DEV_MINT>
spl-token mint <MOGA_DEV_MINT> 1000000000000   # adjust supply
```

- Optional Token-2022 (if needed):
```
spl-token create-token --decimals 9 --token-program <TOKEN_2022_PROGRAM_ID>   # -> MOGA_DEV_MINT
spl-token create-account <MOGA_DEV_MINT>
spl-token mint <MOGA_DEV_MINT> 1000000000000
```

Record these in `.env`:
```
SOLANA_RPC_URL=https://api.devnet.solana.com
RWA_RAFFLE_PROGRAM_ID=<PROGRAM_ID>
MOGA_MINT=<MOGA_DEV_MINT>
USDC_MINT=<USDC_DEV_MINT>
MRFT_COLLECTION_MINT=<MRFT_COLLECTION_MINT>   # when ready
HELIUS_DAS_RPC=<DAS_ENDPOINT>                 # for compressed NFTs listing
```

## 2) Refund Ticket Collection (MRFT)

- Use Metaplex Bubblegum (compressed NFTs) with a devnet tree/collection.
- Offchain worker will mint MRFTs (1 per slot) when refund events fire.
- Listing in frontend uses DAS: `listRefundTicketsViaDas(dasRpcUrl, owner, collection)`.

## 3) Deploy Program to Devnet

- Ensure `Anchor.toml` has `[programs.devnet]` and provider `Devnet`.
- Build & deploy (if you haven’t yet):
```
anchor build
anchor deploy
```

## 4) Create Raffle (Organizer)

Two options:

- A) Direct (no permit) — for quick testing
  - Use SDK builder `createDirectRaffleTx()` (escrow mint is USDC):
  - Escrow ATA must be owned by the raffle PDA (`deriveRafflePda`).

- B) With Permit (ed25519) — production path
  - Build a canonical message with `createRafflePermitMessage()` in SDK.
  - Offchain signs it with organizer key.
  - SDK builder `createRaffleWithPermitTx()` includes ed25519 verify + init.
  - On-chain verification is scaffolded (instructions sysvar) and will be enforced.

Optional registry (planned):
- `OrganizerRegistry` PDA will gate `initialize_raffle` and `set_prize_nft` (allowed collections and subscription tier).

## 5) Prize NFT (RWA)

- Pre-escrow (today): organizer transfers a pre-minted NFT to raffle via `set_prize_nft()`.
  - Future update: verify Metaplex Verified Collection for organizer’s collection.
- Mint-on-claim (planned): store `prize_spec`; mint to winner in `claim_prize` via Token Metadata/Bubblegum CPI.

## 6) Joining the Raffle

Three paths available:

### A) Devnet/legacy (no swap)
- Use `deposit()` to transfer USDC directly and mint a ticket record
- Simple path for testing

### B) 1-TX MOGA path ✅ (feature-gated: `pyth-jupiter`)
- `join_with_moga(slots, max_moga_in)`
  - Validates free slots via `RaffleSlots` bitmap
  - Gets USDC price from Pyth oracle (TODO: implement)
  - Swaps MOGA→USDC via Jupiter CPI (TODO: implement)
  - Reserves slots and deposits USDC
  - Mints ticket record
- **Status**: Instruction scaffolded; Pyth+Jupiter CPI pending

### C) Ticket path ✅ (feature-gated: `bubblegum`)
- `join_with_ticket(slots, nft_refs[])`
  - Validates MRFT collection (TODO: implement)
  - Burns MRFT NFTs via Bubblegum (TODO: implement)
  - Reserves slots and mints ticket record
- **Status**: Instruction scaffolded; Bubblegum burn CPI pending

## 7) Draw and Claim

- Draw triggers:
  - Auto on full (worker or client-chained) or scheduled reveal
  - With Arcium: `request_draw_arcium()` → `draw_callback()` sets `winner_ticket`
  - For tests: `settle_draw(winner_ticket)`
- Claim winner:
  - `claim_win()` (owner-only, single-use, status-gated)
  - `claim_prize()` transfers escrowed prize or mints on-claim
- Organizer payout:
  - `collect_proceeds()` transfers all USDC escrow to organizer’s ATA (single-use)

## 8) Refunds

- After deadline, if not full:
  - Auto: worker calls `refund_batch()` in chunks and mints MRFT on `RefundTicketsRequested`
  - Self-service: user calls `claim_refund()` (also emits events for MRFT mint)
  - Hybrid: both enabled

## 9) Offchain Worker

- See `offchain/README.md` for responsibilities:
  - Threshold/reveal draw scheduling (`request_draw_arcium`), refund crank (`refund_batch`), MRFT minting, notifications
- Permit helper example:
  - Add `offchain/permit_example.ts` to build the canonical message for signing and print it for wallets to sign.

## 10) Local Testing (Optional)

- Run `solana-test-validator` and point Anchor to Localnet.
- Use `deposit()` flow + `settle_draw()` for a no-swap, no-Arcium test cycle.
- Use Bun tests in `ts-sdk/tests/`:
```
bun test
```

## 11) Frontend Hooks (SDK)

- MOGA balance: `getSplTokenBalance(conn, owner, mogaMint)`
- MRFT tickets listing: `listRefundTicketsViaDas(dasRpcUrl, owner, MRFT_COLLECTION_MINT)`
- Builders: `createDirectRaffleTx`, `createRaffleWithPermitTx`, `claimRefundTx`, `claimWinTx`, `collectProceedsTx`
- Coming: `joinWithMogaTx`, `joinWithTicketTx`

## Notes

- Tokens live under SPL/Token-2022 programs; the raffle program is middleware.
- Refund tickets (MRFT) are compressed NFTs; we use DAS to list them.
- Organizer gating and Verified Collection enforcement are being added next.
