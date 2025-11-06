# Program Structure

This document outlines the main accounts, instructions, and events in the `rwa_raffle` program and related on-chain components.

## Accounts

- `Raffle` (PDA: `seeds=["raffle", mint, organizer]`)
  - Fields: `organizer`, `mint` (escrow mint, typically USDC), `escrow`, `required_tickets`, `tickets_sold`, `next_ticket_index`, `deadline`, `status`, `winner_ticket`, `prize_*`
- `Ticket` (PDA: `seeds=["ticket", raffle, owner, start_le]`)
  - Fields: `raffle`, `owner`, `start`, `count`, `refunded`, `claimed_win`
- `RaffleSlots` (PDA: `seeds=["slots", raffle]`)
  - Fields: `required_slots`, `bitmap: Vec<u8>`, `owners: Vec<Pubkey>`
- `OrganizerRegistry` (planned)
  - Organizer gating: `enterprise_id`, `active`, `tier`, `expires_at`, `approved_collections[]`

## Events

- `RaffleInitialized`, `Deposited`, `ThresholdReached`, `RefundTicketsRequested`

## Instructions (current)

- `initialize_raffle(required_tickets, deadline)`
- `deposit(amount, start_index)` and `deposit_compressed(...)`
- `request_draw_arcium(computation_offset)` and `draw_callback(...)`
- `claim_win()` and `claim_prize()`
- `claim_refund()` and `refund_batch()`

## Instructions (upcoming)

- `join_with_moga(slots[], max_moga_in)`
  - Validate free slots via `RaffleSlots`
  - Pyth price; Jupiter CPI swap MOGA→USDC; deposit USDC escrow; set bitmap/owners
- `join_with_ticket(slots[], nft_refs[])`
  - Verify refund NFTs collection; burn via tree authority; set bitmap/owners
- `register_organizer(...)`
  - Create/refresh `OrganizerRegistry`; set `approved_collections` and tier
- `set_prize_nft(...)`
  - Verify Metaplex Verified Collection against organizer’s collection and escrow NFT

## Prize Modes

- `PreEscrow`: organizer escrows an existing NFT into raffle
- `MintOnClaim`: program/authority mints to winner at claim (Token Metadata/Bubblegum CPI)

## Draw Triggers

- Auto on full (client-chained or worker)
- Scheduled reveal (worker waits for `reveal_time_unix_ts`)
- Manual (permissionless)

## Refund Modes

- Auto (worker crank via `refund_batch()`)
- Self-service (`claim_refund()`)
- Hybrid
