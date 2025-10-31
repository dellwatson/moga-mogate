# Architecture: RWA Raffle

- **[MOGA Mint]** SPL Token or Token-2022 mint used for deposits.
- **[Raffle Program]** Anchor program managing escrow, tickets, thresholds, deadlines, settlement.
- **[Arcium MPC]** Verifiable randomness generation; future on-chain callback sets the winner.
- **[Light Protocol]** zk-compressed state for scalable ticket/claim tracking and proofs.
- **[Offchain Worker]** Listens to program events, orchestrates Arcium draws, and manages Light proofs batching.

## Flow

- **[1. Initialize]** Organizer creates a raffle with `required_tokens` and `deadline`, and configures an escrow ATA owned by the raffle PDA.
- **[2. Deposit]** Users transfer MOGA into escrow. Each base unit = 1 ticket; program issues a `Ticket` record with a contiguous numeric range.
- **[3. Activate]** When `total_deposited == required_tokens`, program enters `Drawing` and emits `RandomnessRequested`.
- **[4. Randomness]** Offchain worker submits an Arcium MPC job to generate a uniform random index in `[1..required_tokens]`. In the next iteration, we will use an Arcium callback to set the winner on-chain.
- **[5. Settle]** Winner index is set on-chain. Winner can `claim_win`. If the deadline passes without reaching the threshold, users can `claim_refund`.
- **[6. zk-Compression]** Replace `Ticket` account fan-out with Light compressed accounts to scale participants and batch claims.

See `architecture.svg` for the visual diagram.
