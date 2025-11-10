# RWA Raffle (Solana + Light zk-compression + Arcium randomness)

This monorepo contains an Anchor program and supporting tooling for a token-funded RWA raffle:

- Participants deposit MOGA tokens into an escrow.
- When the required amount is reached before the deadline, a randomness draw selects a winning ticket.
- If the deadline passes without reaching the threshold, deposits are refundable.
- Light Protocol zk-compression is planned for scalable participant/ticket state and batch claims.
- Arcium MPC is planned for verifiable randomness generation and on-chain settlement via callback.

## Packages

- `programs/rwa_raffle/` — Anchor program (Solana)
- `ts-sdk/` — TypeScript SDK for clients (bun-compatible)
- `offchain/` — Offchain worker stub to integrate Arcium + Light and settle draws
- `docs/` — Architecture docs and SVG diagram

## Status

- Initial program scaffolding with escrow and ticket accounting.
- Randomness and compressed accounts integration planned in subsequent tasks.

## Prereqs

- Rust 1.70+
- Solana CLI 2.3.x
- Anchor CLI 0.31.1
- Bun (user preference)

## Dev notes

- Program uses `anchor-spl` token interface to support both SPL Token and Token-2022 mints.
- MOGA mint can be either Token or Token-2022; default client SDK will detect via interface.
- Randomness and zk-compression integration are staged to keep v0 minimal and testable.

See `docs/architecture.md` and `docs/architecture.svg` for the flow.

---

Links:

- `docs/SIMPLIFIED_FLOW.md`
- `docs/decision-flow-v2.svg`
- `docs/REFUND_TICKET_SPEC.md`
- `docs/ZK_COMPRESSION_USAGE.md`

---

## Automation Options

See `docs/RAFFLE_OPTIONS.md` for full details. Summary:

- **Draw Triggers**

  - Auto on full (client-chained): append `request_draw_arcium` after join
  - Auto on full (worker): worker calls `request_draw_arcium` on `ThresholdReached`
  - Scheduled reveal: worker waits until `reveal_time_unix_ts`
  - Manual: any payer can call when `status == Drawing`

- **Refund Modes**

  - Auto (worker crank): call `refund_batch()` at deadline; mint MRFT from events
  - Self-service: users call `claim_refund()`; worker mints MRFT
  - Hybrid: both enabled

- **Notifications**

  - Winners: after `draw_callback`
  - Refunds: after `RefundTicketsRequested` / mint

- **Config (to add)**
  - `auto_draw_on_full: bool`
  - `reveal_time_unix_ts: Option<i64>`
  - `refund_mode: enum { Auto, SelfService, Hybrid }`
  - `prize_mode: enum { PreEscrow, MintOnClaim }`
