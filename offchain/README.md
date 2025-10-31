# Offchain Worker (stub)

This service listens for `RandomnessRequested` events from the `rwa_raffle` program and (in dev) settles the draw by picking a uniform winner index in `[1..required_tickets]`. In production, it will submit an Arcium MPC computation and post the result back on-chain.

## Configuration

- Copy `.env.example` to `.env` and set values.

## Run (dev)

- Uses Bun. Example: `bun run worker.ts` (do not start any dev server; this is a one-shot script or a loop).

