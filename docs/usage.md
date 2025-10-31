# Usage

This guide outlines the on-chain flows and client responsibilities to operate the raffle.

## Program ID

- Generate a new keypair for the program and update both:
  - `programs/rwa_raffle/src/lib.rs` `declare_id!("...")`
  - `Anchor.toml` under `[programs.localnet].rwa_raffle`

## Escrow ATA

- The escrow token account must be owned by the raffle PDA.
- Derive the raffle PDA: seeds = `["raffle", mint, organizer]`.
- Create the escrow associated token account (ATA) for owner = raffle PDA, mint = MOGA.
  - The owner (raffle PDA) does not need to sign ATA creation when using the Associated Token Program; a payer funds the creation.

## Initialize

- Call `initialize_raffle(required_tickets: u64, deadline_unix_ts: i64)` with accounts:
  - `organizer: Signer`
  - `mint: Mint`
  - `escrow_ata: TokenAccount` (owner = raffle PDA, mint = MOGA)
  - `raffle: PDA(["raffle", mint, organizer])`

## Deposit (non-compressed)

- Read `raffle.next_ticket_index`.
- Choose `amount` in base units that is a multiple of `10^decimals` (whole tokens). 1 whole token = 1 ticket.
- Call `deposit(amount, start_index)` where `start_index = raffle.next_ticket_index`.
  - Accounts: `payer`, `raffle`, `mint`, `payer_ata`, `escrow_ata`, `ticket(PDA)`, `token_program`, `system_program`
- The program transfers tokens into escrow and mints a `Ticket` account with a contiguous `[start..start+count-1]` range.

## Deposit (Light zk-compressed)

- Same preconditions as non-compressed, but instead of creating a normal `Ticket` account, it creates a compressed account.
- Call `deposit_compressed(proof, address_tree_info, output_state_tree_index, amount, start_index)` with accounts:
  - `signer: Signer`, `raffle`, `mint`, `payer_ata`, `escrow_ata`, `token_program`
  - plus Light protocol remaining accounts for the specified tree (V1/V2) and the validity proof.
- Emits the same `Deposited` event; state counters update identically.

## Activation

- When `tickets_sold == required_tickets`, the program moves to `Drawing` and emits `ThresholdReached`.

## Randomness

- Option A (dev): Organizer calls `request_draw()`; offchain observes `RandomnessRequested(raffle, supply)` and submits `settle_draw(winner_ticket)`.
- Option B (Arcium):
  - Call `init_draw_comp_def` once to initialize the computation definition PDA.
  - Call `request_draw_arcium(computation_offset)` to queue the encrypted `draw` computation (argument is `required_tickets`).
  - The `draw_callback` sets `winner_ticket` and transitions the raffle to `Completed` on success.

## Refunds

- If deadline passes and threshold was not reached, users can call `claim_refund()` with their `Ticket`.
- The program transfers whole tokens from escrow back to the payer.

## Winner Claim

- After `settle_draw`, winner can call `claim_win()` with their `Ticket` whose range includes `winner_ticket`.
- Offchain fulfillment of RWA/NFT is handled externally.

## Prize NFT

- Organizer escrows the prize NFT (Token-2022 or SPL NFT; decimals must be `0`) under the raffle PDA via `set_prize_nft` with accounts:
  - `organizer`, `raffle`, `prize_mint (decimals=0)`, `organizer_prize_ata`, `prize_escrow`, `token_program`
- After winner claims win, they can call `claim_prize` to transfer the NFT from `prize_escrow` to the winner’s ATA.

## Notes

- Requires whole-token deposits; otherwise `MustDepositWholeTokens` error.
- Supports SPL Token and Token-2022 through `token_interface`.
- For Light trees: prefer V2 on local/dev, V1 on mainnet.
