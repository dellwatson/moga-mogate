# Implementation Status

## ✅ Completed Features

### Program (Anchor)

- **Raffle initialization**
  - `initialize_raffle()` - Direct init (organizer signature only)
  - `initialize_raffle_with_permit()` - With ed25519 permit (verification TODO)
  - `RaffleSlots` PDA for slot reservation bitmap

- **Deposit flows**
  - `deposit()` - Legacy/devnet (direct USDC transfer)
  - `deposit_compressed()` - Light Protocol compressed tickets

- **Join flows** (feature-gated, scaffolded)
  - `join_with_moga()` - MOGA→USDC swap + slot reservation (Pyth+Jupiter CPI TODO)
  - `join_with_ticket()` - MRFT burn + slot reservation (Bubblegum CPI TODO)

- **Draw**
  - `request_draw()` - Emit event for offchain worker
  - `request_draw_arcium()` - Arcium MPC computation
  - `draw_callback()` - Arcium callback to set winner
  - `settle_draw()` - Fallback for dev/test

- **Refunds**
  - `claim_refund()` - User self-service refund
  - `refund_batch()` - Permissionless crank for automation
  - Emits `RefundTicketsRequested` for MRFT minting

- **Claims**
  - `claim_win()` - Winner marks claim on-chain
  - `claim_prize()` - Winner receives escrowed NFT prize

- **Organizer payout**
  - `collect_proceeds()` - Transfer USDC escrow to organizer

- **Prize management**
  - `set_prize_nft()` - Escrow pre-minted NFT (Verified Collection check TODO)

### SDK (TypeScript)

- **Modules**
  - `raffle.ts` - Tx builders for all instructions
  - `tokens.ts` - SPL balance helpers
  - `tickets.ts` - MRFT listing via DAS
  - `rwa.ts` - RWA asset helpers via DAS
  - `solanaKit.ts` - ed25519 verify instruction builder

- **Builders**
  - `createDirectRaffleTx()` ✅
  - `createRaffleWithPermitTx()` ✅ (with ed25519 verify ix)
  - `joinWithMogaTx()` ✅ (accounts scaffolded; Pyth+Jupiter TODO)
  - `joinWithTicketTx()` ✅ (accounts scaffolded; Bubblegum TODO)
  - `claimRefundTx()` ✅
  - `claimWinTx()` ✅
  - `collectProceedsTx()` ✅

- **Helpers**
  - `createRafflePermitMessage()` - Canonical permit message builder
  - `deriveRafflePda()`, `deriveTicketPda()`, `deriveSlotsPda()`
  - `getSplTokenBalance()`, `toUiAmount()`
  - `listRefundTicketsViaDas()` - List MRFT by collection

### Offchain

- **Organizer management** (off-chain for now)
  - `organizer_db.ts` - In-memory registry (replace with DB in prod)
  - `permit_example.ts` - Demo script to issue permits
  - Functions: `registerOrganizer()`, `issuePermit()`, `signPermit()`
  - Commented-out on-chain `OrganizerProfile` PDA code for future

- **Worker** (`worker.ts`)
  - Stub for draw scheduling and refund automation
  - TODO: Implement event listeners and MRFT minting

### Docs

- `LAUNCH_GUIDE.md` - Devnet setup and launch flow
- `DEVNET_SETUP.md` - Token creation and SDK usage
- `PROGRAM_STRUCTURE.md` - Accounts, instructions, events
- `RAFFLE_OPTIONS.md` - Automation vs self-service
- `IMPLEMENTATION_STATUS.md` - This file
- `offchain/README.md` - Offchain architecture and next steps

---

## 🚧 In Progress / TODO

### Program

- **Pyth + Jupiter integration** (feature: `pyth-jupiter`)
  - Add Pyth price account to `JoinWithMoga`
  - Implement Jupiter swap CPI in `join_with_moga()`
  - Add slippage protection

- **Bubblegum integration** (feature: `bubblegum`)
  - Add Bubblegum accounts to `JoinWithTicket`
  - Implement MRFT collection verification
  - Implement Bubblegum burn CPI in `join_with_ticket()`

- **Ed25519 permit verification**
  - Implement instructions sysvar parsing in `initialize_raffle_with_permit()`
  - Verify ed25519 signature matches organizer pubkey

- **Verified Collection enforcement**
  - Add Metaplex metadata parsing in `set_prize_nft()`
  - Verify prize NFT belongs to organizer's allowed collection

- **On-chain organizer registry** (optional, for later)
  - Add `OrganizerProfile` PDA account
  - Add `register_organizer()` instruction (admin-only)
  - Check `OrganizerProfile` in `initialize_raffle_with_permit()` and `set_prize_nft()`

### SDK

- **Complete join builders**
  - Add Pyth price account to `joinWithMogaTx()`
  - Add Jupiter swap accounts to `joinWithMogaTx()`
  - Add Bubblegum accounts to `joinWithTicketTx()`

- **Helpers**
  - Add `getAvailableSlots()` to query `RaffleSlots` bitmap
  - Add `estimateMogaForSlots()` using Pyth price

### Offchain

- **Worker implementation**
  - Event listener for `ThresholdReached`, `RefundTicketsRequested`, `WinnerSelected`
  - Auto-draw: call `request_draw_arcium()` when raffle full
  - Auto-refund: call `refund_batch()` at deadline
  - MRFT minting: mint compressed NFTs via Bubblegum on refund events
  - Notifications: email/push to winners and refund recipients

- **Backend API**
  - REST/GraphQL endpoints for permit issuance
  - Organizer CRUD (register, update, list)
  - Database integration (PostgreSQL/MongoDB)
  - Secure key management (AWS KMS, HashiCorp Vault)

### Testing

- **Unit tests**
  - Test all instructions with Anchor test suite
  - Test slot reservation logic
  - Test refund batch processing

- **Integration tests**
  - End-to-end raffle flow (init → join → draw → claim)
  - Permit signature verification
  - MRFT minting and listing

---

## 📋 Feature Flags

- `default` - Core raffle functionality (no external integrations)
- `pyth-jupiter` - Enable MOGA swap path (requires Pyth + Jupiter)
- `bubblegum` - Enable MRFT ticket path (requires Metaplex Bubblegum)

Build with features:
```bash
anchor build --features pyth-jupiter,bubblegum
```

---

## 🎯 Priorities

1. **High**: Complete Pyth + Jupiter integration for `join_with_moga()`
2. **High**: Complete Bubblegum integration for `join_with_ticket()`
3. **High**: Implement worker event listeners and MRFT minting
4. **Medium**: Ed25519 permit verification in program
5. **Medium**: Backend API for permit issuance
6. **Low**: On-chain organizer registry (optional, can stay off-chain)
7. **Low**: Verified Collection enforcement (can be done off-chain for now)

---

## 📝 Notes

- **Off-chain first**: Organizer management and collection enforcement can stay off-chain (backend DB + permit signing) for MVP
- **On-chain later**: When ready for decentralization, uncomment `OrganizerProfile` PDA code and add to program
- **Feature gates**: Pyth+Jupiter and Bubblegum are behind feature flags to keep program size manageable
- **Modular design**: Each join path is independent; can ship `deposit()` first, then add MOGA/MRFT paths later
