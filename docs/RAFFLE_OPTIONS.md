# Raffle Options (Automation vs Self-Service)

This document enumerates configurable behaviors for draw, refunds, and notifications. These are product-level options backed by on-chain fields and offchain automation.

## Draw (Winner Selection)

- Auto on Full (client-chained)
  - When the last join fills `required_tickets`, the client optionally appends `request_draw_arcium` as the next instruction in the SAME transaction.
  - Pros: instant; no worker dependency for trigger
  - Cons: larger tx (join + swap + draw accounts)

- Auto on Full (worker)
  - Program emits `ThresholdReached`; worker sees it and calls `request_draw_arcium`.
  - Pros: small user tx; robust automation
  - Cons: requires worker uptime

- Scheduled Reveal
  - Organizer sets `reveal_time_unix_ts`. Worker waits until that time (even if full earlier) and calls `request_draw_arcium`.
  - Pros: synchronized reveal events; marketing

- Manual Draw
  - Any payer calls `request_draw_arcium` when `status == Drawing`.
  - Pros: permissionless fallback

## Refunds (Not Full by Deadline)

- Auto (Worker Crank)
  - Worker detects `now > deadline` and `status == Selling`; calls `refund_batch()` in chunks.
  - Worker listens to `RefundTicketsRequested` and mints compressed refund NFTs (MRFT), one per slot.
  - Pros: users do nothing; timely refunds

- Self-Service
  - Users call `claim_refund()` to mark their tickets refunded; event triggers NFT mint by worker.
  - Optional enhancement: `claim_refund_with_mint` (future) to mint via Bubblegum CPI in the same tx if user provides Bubblegum accounts.

- Hybrid
  - Both Auto and Self-Service enabled. Auto covers stragglers; users can also claim early after deadline.

## Notifications

- Winner Notifications
  - Trigger: `draw_callback` sets `winner_ticket`.
  - Offchain looks up winner address → user profile (email/push) → sends message.
  - Optionally write on-chain note via events only; PII stays off-chain.

- Refund Notifications
  - Trigger: `RefundTicketsRequested` or after minting MRFT.
  - Notify owners with NFT proofs/links.

## Organizer Controls (Raffle Config)

Proposed on-chain fields to add (defaults shown):

- `auto_draw_on_full: bool` (default: false)
- `reveal_time_unix_ts: Option<i64>` (default: None)
- `refund_mode: u8` enum { Auto, SelfService, Hybrid } (default: Hybrid)
- `prize_mode: u8` enum { PreEscrow, MintOnClaim } (default: PreEscrow)

Registry-driven policies (separate PDA):
- Organizer subscription tier and expiry
- Approved NFT collection for `set_prize_nft`
- Optional webhook URL for organization-specific notifications

## Implementation Status

- Program
  - `refund_batch()` added; `claim_refund()` emits `RefundTicketsRequested`.
  - `RaffleSlots` account scaffolded for slot reservation.
- Offchain
  - Responsibilities documented in `offchain/README.md`.
- Docs
  - Refund ticket spec in `docs/REFUND_TICKET_SPEC.md`.

## Next Steps

- Add config fields above to `Raffle` and wire checks
- Implement `join_with_moga` and `join_with_ticket` using `RaffleSlots`
- Implement optional `claim_refund_with_mint` (Bubblegum CPI path) for self-minting
- Build worker jobs: threshold draw, scheduled reveal, refund crank, notifications
