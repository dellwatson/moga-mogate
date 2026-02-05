# Darkpool Raffle (TEE) Setup

This guide explains how to set up the TEE-backed raffle flow with iExec on EVM.

## 1) Choose Privacy Mode

The contract is `contracts/RaffleTEE.sol`. It supports **two privacy modes** in one contract:

- `SLOTS_ONLY` (private slot selection, public participants/payments)
- `FULL` (private participants + amounts, on-chain only sees a tickets root + winner)

You select the mode when calling `createRaffle(..., privacy)`.

## 2) Deploy the RaffleTEE Contract (Arbitrum Sepolia)

`RaffleTEE` must allow the iExec Hub address as the caller for `receiveResult`.
iExec publishes the PoCo Diamond Proxy (Hub) addresses per network.

Example:

```bash
TARGET_NETWORK=arbitrumSepolia \
bun run evm:tee:deploy
```

### Deployment Record (Arbitrum Sepolia)

```
RaffleTEE: 0x5b6288be71623E408D61D0417A51572d7CBC10e2
Deploy tx: 0x718110754b65324133b0dd4f6ad048123baae5d1035639171f61ac297abb8265
IExec Hub: 0xB2157BF2fAb286b2A4170E3491Ac39770111Da3E
Deployer: 0xA31A54e4C258B1BE8cE887a2724906BfCe88Cc6A
```

## 3) Build, Test, Deploy the iApp (TEE)

For real testnet or production execution, you **deploy your iApp** to a supported iExec network and then **run** it there.

The iExec docs show:

- Build and test locally.
- Deploy to a supported network (Arbitrum Sepolia is recommended for test).
- Run the iApp so the protocol executes it.

### Required callback format

Your iApp must write `${IEXEC_OUT}/computed.json` with a `callback-data` field
(ABI‑encoded bytes). After task validation, iExec calls
`receiveResult(bytes32,bytes)` on your contract.

The callback gas limit is capped by the protocol, so keep it light.

## 4) Run the iApp with a Callback

When running the iExec task, set the **callback** address to your deployed
`RaffleTEE` contract. The callback bytes should decode as:

```
(bytes32 raffleIdHash, address winner, uint256 winnerIndex, bytes32 ticketsRoot)
```

The iExec result‑callback flow is documented in their guide (see links below).

## 5) Register the iExec Task ID (callId)

When your task is submitted, you’ll receive a **taskId**. Register it on-chain:

```bash
RAFFLE_ID=your-raffle-id \
RAFFLE_DRAW_CALL_ID=0x... \
bun run evm:tee:register-draw
```

Once the task completes and is validated, iExec triggers `receiveResult`.

## 6) User Flows

### A) Slots‑Only (private slots, public payments)

1. Organizer hosts raffle: `createRaffle(..., privacy = SLOTS_ONLY)`.
2. Frontend checks availability using `isSlotTaken` / `getSlotStatusBatch`.
3. Users generate commitments: `hash(raffleIdHash, slotId, salt, buyer)`.
4. Users call `joinSlotsOnlyWithSlots` (or `joinSlotsOnly`) with commitments + ETH.
5. Organizer prepares public config JSON (commitments list).
Example:

```bash
RAFFLE_ID=your-raffle-id \
RAFFLE_MODE=slots-only \
bun run evm:tee:prepare-config
```
6. Organizer runs the iExec task (TEE draw).
7. Register `taskId` on-chain (`registerDrawCall`).
8. iExec callback sets the winner.

### B) Full Privacy (participants + amounts off‑chain)

1. Organizer hosts raffle: `createRaffle(..., privacy = FULL)`.
2. Users submit encrypted tickets + payments off-chain.
3. Organizer builds tickets root and commits with `commitTicketsRoot`.
4. Organizer runs iExec task using protected data inputs.
5. Register `taskId` on-chain (`registerDrawCall`).
6. iExec callback sets the winner.

## 7) iApp Deploy/Run Scripts

Prepare deploy (fills `iapp.config.json` from env when provided) and deploy:

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

## 8) Useful iExec Docs

- Deploy & run iApp: https://docs.iex.ec/guides/build-iapp/deploy-%26-run  
- Result callback: https://docs.iex.ec/guides/build-iapp/advanced/result-callback  
- Supported networks: https://docs.iex.ec/get-started/tooling-and-explorers/blockchain-explorer  
- PoCo hub addresses: https://docs.iex.ec/get-started/tooling-and-explorers/important-addresses  
