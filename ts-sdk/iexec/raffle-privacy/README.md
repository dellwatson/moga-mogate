# Raffle Privacy iApp (TEE)

This iApp processes raffle tickets in a TEE and produces a callback payload for
`RaffleTEE.receiveResult(bytes32,bytes)` on Arbitrum.

It supports **two modes**:

- `slots-only` (private slot selection, public commitments)
- `full` (private participants + amounts, on-chain only gets ticketsRoot + winner)

## Quick Start

```bash
cd ts-sdk/iexec-test/raffle-privacy
npm install
iapp test --verbose
```

## Next Step (Recommended)

Host a raffle on-chain, then run the iApp with a public config JSON file:

- Slots-only template: `input/raffle-config.slots-only.json`
- Full-privacy template: `input/raffle-config.full.json`

## Inputs

### 1) Public config JSON (input file)

Pass a public JSON file as `--inputFile` (or via iExec input files):

```json
{
  "mode": "slots-only",
  "raffleId": "raffle-123",
  "commitments": [
    "0xabc...",
    "0xdef..."
  ],
  "expectedTickets": 2
}
```

- `mode` must be `slots-only` or `full`.
- `commitments` are the on-chain slot commitments (required for slots-only).
- `expectedTickets` is optional; if set, the iApp enforces the count.

### 2) Protected data (tickets)

Each protected dataset must contain a `payload` JSON string, for example:

Slots-only (one ticket):
```json
{
  "payload": "{\"raffleId\":\"raffle-123\",\"buyer\":\"0x...\",\"slotId\":1,\"salt\":\"0x...\"}"
}
```

Full-privacy (one ticket):
```json
{
  "payload": "{\"raffleId\":\"raffle-123\",\"buyer\":\"0x...\",\"ticketId\":42,\"salt\":\"0x...\"}"
}
```

You can also send a batch in one dataset:
```json
{
  "payload": "{\"raffleId\":\"raffle-123\",\"tickets\":[{\"buyer\":\"0x...\",\"slotId\":1,\"salt\":\"0x...\"},{\"buyer\":\"0x...\",\"slotId\":2,\"salt\":\"0x...\"}]}"
}
```

## Output

The iApp writes:

- `${IEXEC_OUT}/result.json` (summary)
- `${IEXEC_OUT}/computed.json` with:
  - `deterministic-output-path`
  - `callback-data`

`callback-data` is ABI-encoded as:

```
(bytes32 raffleIdHash, address winner, uint256 winnerIndex, bytes32 ticketsRoot)
```

This is the payload expected by `RaffleTEE.receiveResult(...)`.

## Deployment Record (Arbitrum Sepolia)

Saved in `deployment.arbitrum-sepolia.json`:

```json
{
  "network": "arbitrumSepolia",
  "chainId": 421614,
  "raffleTeeAddress": "0xE39C0AAA925337a5499A2cCe0D906cc38B5CEA54",
  "deployTxHash": "0xd746b2c493729522aeb7fa9d37ccee0e4c8827e5e562559a757325ec3f4044aa",
  "iexecHub": "0xB2157BF2fAb286b2A4170E3491Ac39770111Da3E",
  "deployer": "0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A"
}
```

## Slots-Only Flow (Complete)

1. **On-chain joins**  
   Users call `joinSlotsOnly(...)` with commitments (public on-chain).

2. **Protected data tickets**  
   Each participant sends a protected dataset to the organizer containing:
   `raffleId`, `buyer`, `slotId`, `salt`.

3. **Organizer runs iApp**  
   The organizer runs the iApp with:
   - public config JSON including commitments
   - protected data inputs for tickets

4. **TEE picks winner**  
   The iApp:
   - validates commitments
   - builds a deterministic tickets root
   - selects a winner using `IEXEC_TASK_ID` as entropy

5. **iExec callback**  
   iExec calls `receiveResult` on the `RaffleTEE` contract with callback-data.

## Full Privacy Flow (Complete)

1. **Off-chain tickets + payments**  
   Participants submit encrypted tickets and payments off-chain.

2. **Organizer runs iApp**  
   The organizer runs the iApp with protected data inputs (no commitments needed).

3. **TEE picks winner + ticketsRoot**  
   The iApp computes a tickets root and winner, then returns callback-data.

4. **On-chain finalize**  
   `receiveResult` stores the winner and ticketsRoot in `RaffleTEE`.

## Notes

- `iapp test` uses Docker and can be slow if the base image is not cached.
- For testnet or production, you must `iapp deploy` and `iapp run` on iExec.
