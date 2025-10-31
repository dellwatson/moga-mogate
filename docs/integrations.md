# Integrations Plan

## Arcium (Randomness)

- **Goal**: Uniform winner index in `[1..required_tickets]` with verifiable MPC.
- **Crates**: add `arcium-anchor`, `arcium-client`, `arcium-macros` (already added in `programs/rwa_raffle/Cargo.toml`).
- **Steps**:
  - Create `encrypted-ixs/draw/` with a computation that:
    - Takes `required_tickets: u64`, `nonce/seed`.
    - Produces `winner_ticket: u64` = `1 + (rand % required_tickets)`.
  - In program module, add:
    - `#[arcium_program]` on the module.
    - `init_draw_comp_def(ctx)` similar to `coinflip` `init_flip_comp_def`.
    - `request_draw`: `queue_computation` with args `[PlaintextU64(required_tickets), PlaintextU128(nonce)]` and callback `draw_callback`.
    - `#[arcium_callback(encrypted_ix = "draw")] draw_callback(ctx, outputs)` to set `winner_ticket` and `Completed` status.
  - Provide `Arcium.toml` (already present) and follow `arcium-examples/coinflip` migration/setup patterns.

## Light Protocol (zk-compression)

- **Goal**: Scale tickets/claims with compressed accounts and batch updates.
- **Crates**: `light-sdk`, `light-hasher` (already added).
- **Steps**:
  - Define a compressed `TicketCompressed` struct with `LightDiscriminator` and `LightHasher` derivations.
  - In `deposit`, switch from Anchor `Ticket` account to `LightAccount::<TicketCompressed>` creation via `LightSystemProgramCpi`.
  - In `claim_refund`/`claim_win`, require `ValidityProof` + `CompressedAccountMeta` to update/close the compressed account.
  - Choose tree version:
    - V2 for local/dev (lower CU), V1 for mainnet.
  - Reuse patterns from `program-examples/counter/anchor`.

## Token/NFT prize

- Optional extension: escrow an NFT (tokenized RWA) to the raffle PDA and transfer to winner upon `Completed`.

## Client SDK

- Add IDL after building program and wire `@coral-xyz/anchor` Program in SDK.
- PDA helpers:
  - `rafflePda = findProgramAddressSync(["raffle", mint, organizer])`
  - `ticketPda = findProgramAddressSync(["ticket", raffle, owner, startIndexLE8])`
- Builders for: `initialize_raffle`, `deposit`, `request_draw`, `settle_draw`, `claim_refund`, `claim_win`.
