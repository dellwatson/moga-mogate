# Offchain Worker & Organizer Management

This directory contains offchain services for the RWA raffle system:

1. **Organizer Management** (`organizer_db.ts`, `permit_example.ts`)
2. **Worker Service** (`worker.ts`)

---

## 1. Organizer Management (Off-chain)

### Files
- **`organizer_db.ts`**: In-memory organizer registry (replace with PostgreSQL/MongoDB in production)
- **`permit_example.ts`**: Demo script to issue permits for organizers

### How it works
- Backend maintains an allowlist of approved organizers (business partners)
- Each organizer has:
  - `publicKey`: Wallet address
  - `enterpriseId`: Business partner ID
  - `tier`: Subscription level (free/pro/enterprise)
  - `allowedCollections`: RWA NFT collections they can use as prizes
  - `active`: Admin can enable/disable

- When an organizer wants to create a raffle:
  1. Frontend requests a permit from backend API
  2. Backend validates organizer is active
  3. Backend builds canonical message and signs with ed25519
  4. Frontend calls `createRaffleWithPermitTx()` with permit signature
  5. Program verifies ed25519 signature in `initialize_raffle_with_permit()`

### Run permit example
```bash
bun run offchain/permit_example.ts
```

### Future: On-chain registry
- Commented-out code in `organizer_db.ts` shows how to add `OrganizerProfile` PDA
- When ready, uncomment and add `register_organizer()` instruction to program
- This enables decentralized verification and on-chain proof of organizer status

---

## 2. Worker Service

### Responsibilities

#### Draw scheduling and execution
- Watch `ThresholdReached` events (raffle full) or scheduled reveal time
- Call `request_draw_arcium()` when `raffle.status == Drawing`
- Wait for `draw_callback()` to set `winner_ticket` and mark `Completed`
- Fallback: call `settle_draw(winner_ticket)` for dev/test

#### Automatic refunds (no user action)
- At deadline, if raffle not full, call `refund_batch()` in chunks
- Listen to `RefundTicketsRequested` events
- Mint refund NFTs (compressed, 1 per slot) via Bubblegum to each user

#### Notifications (optional)
- Email/push to winners
- Inform participants of refund NFTs minted

### Configuration
- Copy `.env.example` to `.env` and set:
  - `SOLANA_RPC_URL`
  - `RWA_RAFFLE_PROGRAM_ID`
  - `WORKER_KEYPAIR_PATH`
  - `HELIUS_DAS_RPC` (for compressed NFT minting)

### Run (dev)
```bash
bun run offchain/worker.ts
```

### Notes
- Draw is permissionless: any payer can call `request_draw_arcium` when `status == Drawing`
- Refunds are idempotent: `refund_batch` and events can be replayed safely
- Worker automates these flows for better UX

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  - Request permit from backend API                           │
│  - Call createRaffleWithPermitTx() with signature            │
│  - Join raffle (MOGA/USDC/MRFT)                              │
│  - Claim win/refund                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Express/Fastify)                   │
│  - organizer_db.ts: Manage organizer allowlist               │
│  - Issue permits (ed25519 signature)                         │
│  - Validate organizer tier and collections                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           Solana Program (rwa_raffle)                        │
│  - initialize_raffle_with_permit() verifies ed25519          │
│  - join_with_moga() / join_with_ticket()                     │
│  - Emit events: ThresholdReached, RefundTicketsRequested     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Offchain Worker (worker.ts)                  │
│  - Listen to events                                          │
│  - Auto-draw via request_draw_arcium()                       │
│  - Auto-refund via refund_batch()                            │
│  - Mint MRFT (compressed NFTs) via Bubblegum                 │
│  - Send notifications                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Production DB**: Replace in-memory `organizerDb` with PostgreSQL/MongoDB
2. **Secure key management**: Use AWS KMS / HashiCorp Vault for backend signing key
3. **API endpoints**: Add REST/GraphQL endpoints for permit issuance
4. **Worker deployment**: Deploy worker as a long-running service (Docker/K8s)
5. **On-chain registry** (optional): Uncomment `OrganizerProfile` PDA code and add to program
