# Raffle Privacy iApp (TEE)

This iApp processes raffle tickets in a TEE and produces a callback payload for
`RaffleTEE.receiveResult(bytes32,bytes)` on Arbitrum.

It supports **two modes**:

- `slots-only` (private slot selection, public commitments)
- `full` (private participants + amounts, on-chain only gets ticketsRoot + winner)

## Quick Start

```bash
cd ts-sdk/iexec/raffle-privacy
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
- `${IEXEC_OUT}/computed.json` containing `deterministic-output-path` and `callback-data`

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
  "raffleTeeAddress": "0x5b6288be71623E408D61D0417A51572d7CBC10e2",
  "deployTxHash": "0x718110754b65324133b0dd4f6ad048123baae5d1035639171f61ac297abb8265",
  "iexecHub": "0xB2157BF2fAb286b2A4170E3491Ac39770111Da3E",
  "deployer": "0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A"
}
```

## Slots-Only Flow (Complete)

1. **On-chain joins**  
Users call `joinSlotsOnlyWithSlots(...)` (or `joinSlotsOnly(...)`) with commitments and ETH.

2. **Slot availability (optional)**  
Frontend can query `isSlotTaken(raffleId, slotId)` or `getSlotStatusBatch(...)`.

3. **Protected data tickets**  
Each participant sends protected data containing `raffleId`, `buyer`, `slotId`, `salt`.

4. **Prepare public config JSON**  
Example:

```bash
RAFFLE_ID=raffle-123 \
RAFFLE_MODE=slots-only \
bun run evm:tee:prepare-config
```

5. **Organizer runs iApp**  
Run the iApp with the public config and protected data inputs.

6. **TEE picks winner + callback**  
The iApp validates commitments, builds tickets root, selects winner, and iExec calls `receiveResult`.

## Full Privacy Flow (Complete)

1. **Off-chain tickets + payments**  
Participants submit encrypted tickets and payments off-chain.

2. **Commit tickets root (optional)**  
Organizer can call `commitTicketsRoot(raffleId, ticketsRoot, soldTickets)`.

3. **Organizer runs iApp**  
Run the iApp with protected data inputs only (no commitments required).

4. **TEE picks winner + callback**  
The iApp computes a tickets root and winner, and iExec calls `receiveResult`.

## Deploy + Run Scripts

Deploy iApp (fills `iapp.config.json` from env when provided):

```bash
DOCKERHUB_USERNAME=yourname \
DOCKERHUB_ACCESS_TOKEN=your_pat \
IAPP_WALLET_PRIVATE_KEY=$PRIVATE_KEY_ETH \
bun run tee:iapp:deploy
```

Run a task (returns a `taskId`):

```bash
IAPP_ADDRESS=0xYourIAppAddress \
IAPP_CHAIN=arbitrum-sepolia-testnet \
PUBLIC_CONFIG_URL=https://your-host/public-config.json \
PROTECTED_DATA_ADDRESSES=0xProtected1,0xProtected2 \
bun run tee:iapp:run
```

## Notes

- `iapp test` uses Docker and can be slow if the base image is not cached.
- For testnet or production, you must `iapp deploy` and `iapp run` on iExec.
