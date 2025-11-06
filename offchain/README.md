# Offchain Worker (stub)

This service listens for `RandomnessRequested` events from the `rwa_raffle` program and (in dev) settles the draw by picking a uniform winner index in `[1..required_tickets]`. In production, it will submit an Arcium MPC computation and post the result back on-chain.

## Configuration

- Copy `.env.example` to `.env` and set values.

## Run (dev)

- Uses Bun. Example: `bun run worker.ts` (do not start any dev server; this is a one-shot script or a loop).

## Responsibilities

- Draw scheduling and execution:
  - Watch `ThresholdReached` and/or a configured reveal time.
  - Call `request_draw_arcium` when `raffle.status == Drawing`.
  - Wait for `draw_callback` to set `winner_ticket` and mark `Completed`.

- Automatic refunds (no user action):
  - At deadline, when not full, call `refund_batch` in chunks.
  - Listen to `RefundTicketsRequested` and mint refund NFTs (compressed, 1 per slot) to each user.

- Notifications (optional):
  - Email / push to winners.
  - Inform participants of refund NFTs minted.

## Notes

- Draw is permissionless: any payer can call `request_draw_arcium` when `status == Drawing`, but the worker automates it (and handles scheduled reveal).
- Refunds are idempotent: `refund_batch` and events can be replayed safely; tickets carry a `refunded` flag.
