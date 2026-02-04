# @moga/rwa-raffle-sdk

Frontend-ready TypeScript SDK for the **EVM Raffle** and **RaffleTEE** contracts.

## Features

- ✅ Ethers v6 clients for `Raffle.sol` and `RaffleTEE.sol`
- ✅ Browser-friendly (no `fs`, no `path`)
- ✅ Helpers for commitments + typed reports
- ✅ Bun compatible

## Installation

```bash
bun add @moga/rwa-raffle-sdk ethers
```

## Usage (Frontend)

```ts
import { evm } from "@moga/rwa-raffle-sdk";
import { BrowserProvider } from "ethers";

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const client = evm.createRaffleClientFromSigner({
  signer,
  raffleAddress: "0xYourRaffleAddress",
});

const load = await client.raffle.getRaffleLoadDetail("raffle-123");
```

## Usage (Server/Scripts)

```ts
import { evm } from "@moga/rwa-raffle-sdk";

const client = evm.createRaffleClient({
  rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  privateKey: process.env.PRIVATE_KEY_ETH!,
  raffleAddress: "0xYourRaffleAddress",
});

await client.raffle.getRaffleResult("raffle-123");
```

## TEE Helpers (RaffleTEE)

```ts
import { tee } from "@moga/rwa-raffle-sdk";

const commitment = tee.buildSlotCommitment({
  raffleId: "raffle-123",
  slotId: 1n,
  salt: "0x...",
  buyer: "0xBuyerAddress",
});
```

## Development (local)

In this monorepo, scripts import directly from `ts-sdk/src/...` during development.

```bash
bun run build
bun test
```

## License

Apache-2.0
